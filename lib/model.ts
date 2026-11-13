// Every model call goes through here: one client per timeout, the static system prompt
// marked for prompt caching, 429/529 retries, and a usage record per call (tokens, cache
// tokens, USD, duration) that the session's log and the spend limit are built from.

import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./anthropic-retry";
import { log } from "./log";
import { costUsd } from "./pricing";

export type CallRecord = {
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  usd: number;
  ms: number;
};

/**
 * What a piece of work spent. `inputTokens` counts every prompt token, cached or not, so the
 * per-session budget sees the whole prompt; `calls` keeps the breakdown.
 */
export type Usage = { inputTokens: number; outputTokens: number; calls: CallRecord[] };

export const newUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, calls: [] });

export function mergeUsage(a: Usage, b: Usage): Usage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, calls: [...a.calls, ...b.calls] };
}

export const usdOf = (u: Usage) => u.calls.reduce((n, c) => n + c.usd, 0);

/** What a response bills: the fields shared by Messages and beta Messages responses. */
export type Billed = {
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
};

/** Adds one response to `usage` and logs it. Test doubles may leave out the cache fields. */
export function recordCall(usage: Usage, step: string, model: string, res: Billed, ms: number): CallRecord {
  const u = res.usage;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const record: CallRecord = {
    step,
    model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    usd: costUsd(model, { input: u.input_tokens, output: u.output_tokens, cacheRead, cacheWrite }),
    ms,
  };
  usage.inputTokens += u.input_tokens + cacheRead + cacheWrite;
  usage.outputTokens += u.output_tokens;
  usage.calls.push(record);
  log.info("model.call", { ...record, stop_reason: res.stop_reason });
  return record;
}

const clients = new Map<number, Anthropic>();
/** One shared client per timeout. maxRetries is 0: withRetry owns retries. */
export function client(timeoutMs: number): Anthropic {
  let c = clients.get(timeoutMs);
  if (!c) {
    c = new Anthropic({ timeout: timeoutMs, maxRetries: 0 });
    clients.set(timeoutMs, c);
  }
  return c;
}

export type MessageRequest = {
  model: string;
  /** Names the call in logs and the usage table, e.g. "scan.claims". */
  step: string;
  /** Static per step, so it caches. Anything that varies per request goes in `user`. */
  system: string;
  user: string;
  maxTokens: number;
  format: NonNullable<Anthropic.MessageCreateParamsNonStreaming["output_config"]>["format"];
  timeoutMs: number;
  effort?: "low" | "medium" | "high";
};

/** One structured-output call with the system prompt cached. Retries only when Anthropic is busy. */
export function createMessage(r: MessageRequest): Promise<Anthropic.Message> {
  return withRetry(
    () =>
      client(r.timeoutMs).messages.create({
        model: r.model,
        max_tokens: r.maxTokens,
        output_config: { effort: r.effort ?? "low", format: r.format },
        system: [{ type: "text", text: r.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: r.user }],
      }),
    r.step,
  );
}

/** The response's text blocks, joined: structured output arrives as one JSON text block. */
export const textOf = (res: Anthropic.Message) =>
  res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
