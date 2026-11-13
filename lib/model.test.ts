import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, test } from "vitest";
import { mergeUsage, newUsage, recordCall, usdOf } from "./model";
import { HAIKU, SONNET, costUsd } from "./pricing";

const response = (usage: Partial<Anthropic.Usage>) =>
  ({ stop_reason: "end_turn", content: [], usage: { input_tokens: 0, output_tokens: 0, ...usage } }) as unknown as Anthropic.Message;

describe("pricing", () => {
  test("a million tokens of each kind costs the listed price", () => {
    assert.equal(costUsd(HAIKU, { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }), 0.1);
    assert.equal(costUsd(HAIKU, { input: 0, output: 1e6, cacheRead: 0, cacheWrite: 0 }), 0.5);
    assert.equal(costUsd(SONNET, { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 }), 12);
  });

  test("cache reads cost a tenth of fresh input on Haiku, writes a quarter more", () => {
    const fresh = costUsd(HAIKU, { input: 10_000, output: 0, cacheRead: 0, cacheWrite: 0 });
    assert.equal(costUsd(HAIKU, { input: 0, output: 0, cacheRead: 10_000, cacheWrite: 0 }), fresh / 10);
    assert.equal(costUsd(HAIKU, { input: 0, output: 0, cacheRead: 0, cacheWrite: 10_000 }), fresh * 1.25);
  });

  test("an unknown model is priced as the most expensive one, never as free", () => {
    const t = { input: 1000, output: 1000, cacheRead: 0, cacheWrite: 0 };
    assert.equal(costUsd("claude-made-up", t), costUsd(SONNET, t));
  });
});

describe("usage", () => {
  test("every prompt token counts toward input, cached or not", () => {
    const u = newUsage();
    recordCall(u, "panel", HAIKU, response({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 }), 1200);
    assert.equal(u.inputTokens, 1000);
    assert.equal(u.outputTokens, 50);
    assert.deepEqual(
      { ...u.calls[0], usd: undefined },
      { step: "panel", model: HAIKU, inputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheWriteTokens: 0, usd: undefined, ms: 1200 },
    );
  });

  test("responses without cache fields count them as zero", () => {
    const u = newUsage();
    recordCall(u, "answer", HAIKU, response({ input_tokens: 300, output_tokens: 40 }), 10);
    assert.equal(u.calls[0].cacheReadTokens, 0);
    assert.equal(u.inputTokens, 300);
  });

  test("merged usage keeps every call and the summed cost", () => {
    const a = newUsage();
    const b = newUsage();
    recordCall(a, "scan.claims", HAIKU, response({ input_tokens: 1e6 }), 1);
    recordCall(b, "recheck", HAIKU, response({ output_tokens: 1e6 }), 1);
    const m = mergeUsage(a, b);
    assert.equal(m.calls.length, 2);
    assert.equal(usdOf(m), 0.6);
  });
});
