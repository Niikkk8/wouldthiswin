// The caps checked when a session starts, and never after: a session that started finishes,
// whatever the counters say by then. The database applies the same rules atomically
// (reserve_session_v2 in db/migrations/0001_usage_limits.sql); this is the readable version
// the API and the tests share.

type Env = Record<string, string | undefined>;

export type Limits = {
  /** Sessions one visitor (salted IP hash) may start per UTC day. */
  perUser: number;
  /** Sessions everyone together may start per UTC day. */
  perDay: number;
  /** Logged model spend per UTC day, in USD, after which no new sessions start. */
  spendUsd: number;
};

export const DEFAULT_LIMITS: Limits = { perUser: 5, perDay: 300, spendUsd: 20 };

function positive(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function limitsFromEnv(env: Env = process.env): Limits {
  return {
    perUser: Math.floor(positive(env.MAX_SESSIONS_PER_USER_PER_DAY, DEFAULT_LIMITS.perUser)),
    perDay: Math.floor(positive(env.MAX_SESSIONS_PER_DAY, DEFAULT_LIMITS.perDay)),
    spendUsd: positive(env.DAILY_SPEND_LIMIT_USD, DEFAULT_LIMITS.spendUsd),
  };
}

/** `rateLimited`: this visitor's cap. `dailyCap`: everyone's. `spendCap`: today's model budget. */
export type LimitStatus = "ok" | "rateLimited" | "dailyCap" | "spendCap";

export type Counts = { user: number; day: number; spendUsd: number };

/**
 * The site-wide caps come first: when the judges are asleep for everyone, the visitor is told
 * that, not that they personally used up their sessions.
 */
export function checkCaps(c: Counts, l: Limits): LimitStatus {
  if (c.spendUsd >= l.spendUsd) return "spendCap";
  if (c.day >= l.perDay) return "dailyCap";
  if (c.user >= l.perUser) return "rateLimited";
  return "ok";
}

/** Every counter resets at the next UTC midnight. */
export function nextReset(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Hours and minutes until the reset, rounded up to the minute. */
export function untilReset(now: Date, reset: Date): { hours: number; minutes: number } {
  const total = Math.max(0, Math.ceil((reset.getTime() - now.getTime()) / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
