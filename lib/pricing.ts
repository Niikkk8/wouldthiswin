// What a model call costs, in USD. The only place prices live: the spend limit, the stats
// script and the per-session log all read from here. Update it when Anthropic's prices change.

export const HAIKU = "claude-haiku-5-5";
export const SONNET = "claude-sonnet-5-5";

/** USD per million tokens. Cache writes use the 5-minute TTL rate (1.25x input). */
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number };

// Haiku 5.5 is $0.10 / $0.50 for prompts up to 100K tokens; every prompt here is far below that.
export const PRICES: Record<string, Price> = {
  [HAIKU]: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  [SONNET]: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
};

export type TokenCounts = {
  /** Uncached input tokens (the API's `input_tokens`). */
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

/**
 * The cost of one call. An unknown model is priced as the most expensive one we use, so a
 * typo in a model id can only make the spend limit trip early, never late.
 */
export function costUsd(model: string, t: TokenCounts): number {
  const p = PRICES[model] ?? PRICES[SONNET];
  const usd =
    (t.input * p.input +
      t.output * p.output +
      t.cacheWrite * p.cacheWrite +
      t.cacheRead * p.cacheRead) /
    1e6;
  return Math.round(usd * 1e8) / 1e8;
}
