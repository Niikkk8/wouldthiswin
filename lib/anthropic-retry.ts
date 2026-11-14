// Anthropic answers 429 (rate limited) and 529 (overloaded) when it's busy. Those are worth
// waiting out; nothing else is. Each model call goes through `withRetry`: up to 3 retries,
// backing off, then a SwampedError the routes turn into "The panel's swamped".

import Anthropic from "@anthropic-ai/sdk";
import { log } from "./log";

type APIError = InstanceType<typeof Anthropic.APIError>;

export const MAX_RETRIES = 3;
/** Backoff before each retry. Short: the scan route has 60 seconds for two calls. */
export const BACKOFF_MS = [600, 1200, 2400] as const;
/** A Retry-After longer than this isn't waited for; the backoff is used instead. */
const MAX_RETRY_AFTER_MS = 4000;

export class SwampedError extends Error {
  constructor(public readonly status: number) {
    super(`anthropic busy (${status}) after ${MAX_RETRIES} retries`);
  }
}

export const isBusy = (err: unknown): err is APIError =>
  err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529);

function waitFor(err: APIError, attempt: number): number {
  const base = BACKOFF_MS[attempt];
  const header = Number(err.headers?.get?.("retry-after"));
  const after = Number.isFinite(header) && header > 0 ? header * 1000 : 0;
  // Jitter so a burst of sessions doesn't retry in lockstep.
  const wait = after && after <= MAX_RETRY_AFTER_MS ? after : base;
  return wait + Math.floor(Math.random() * 200);
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs `call`, retrying 429 and 529 up to MAX_RETRIES times. Other errors pass straight through. */
export async function withRetry<T>(
  call: () => Promise<T>,
  label: string,
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (!isBusy(err)) throw err;
      if (attempt >= MAX_RETRIES) {
        log.error("anthropic.swamped", { call: label, status: err.status });
        throw new SwampedError(err.status ?? 529);
      }
      const ms = waitFor(err, attempt);
      log.warn("anthropic.busy", {
        call: label,
        status: err.status,
        retry: attempt + 1,
        wait_ms: ms,
      });
      await sleep(ms);
    }
  }
}
