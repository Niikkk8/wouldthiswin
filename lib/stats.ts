// The numbers behind `npm run stats`, from our own tables (Vercel Hobby has no custom
// events). Pure, so the arithmetic is tested; scripts/stats.ts only fetches and prints.

import type { ActName } from "./session";

export type SessionRow = {
  id: string;
  created_at: string;
  act: ActName;
  shareable: boolean | null;
};

export type UsageRow = {
  session_id: string | null;
  step: string;
  model: string | null;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  usd: number | string;
  duration_ms: number;
};

export type Stats = {
  perDay: { day: string; sessions: number }[];
  cost: { sessions: number; avgUsd: number; p95Usd: number; totalUsd: number };
  byStep: { step: string; calls: number; usd: number; avgMs: number }[];
  /** Share of prompt tokens served from the prompt cache, 0 to 1. */
  cacheHitRate: number;
  funnel: {
    started: number;
    finishedGrilling: number;
    reachedVerdict: number;
    madeShareable: number;
  };
};

const PAST_GRILLING: readonly ActName[] = ["deliberation", "verdict", "share"];
const AT_VERDICT: readonly ActName[] = ["verdict", "share"];

/** Nearest-rank percentile: the smallest value with at least p of the values at or below it. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

const round = (n: number, places = 6) => Math.round(n * 10 ** places) / 10 ** places;

export function computeStats(sessions: readonly SessionRow[], usage: readonly UsageRow[]): Stats {
  const days = new Map<string, number>();
  for (const s of sessions) {
    const day = s.created_at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }

  const perSession = new Map<string, number>();
  const steps = new Map<string, { calls: number; usd: number; ms: number }>();
  let prompt = 0;
  let cached = 0;
  for (const u of usage) {
    const usd = Number(u.usd) || 0;
    if (u.session_id) perSession.set(u.session_id, (perSession.get(u.session_id) ?? 0) + usd);
    const st = steps.get(u.step) ?? { calls: 0, usd: 0, ms: 0 };
    steps.set(u.step, { calls: st.calls + 1, usd: st.usd + usd, ms: st.ms + u.duration_ms });
    if (u.model) {
      prompt += u.input_tokens + u.cache_read_tokens + u.cache_write_tokens;
      cached += u.cache_read_tokens;
    }
  }
  const costs = [...perSession.values()];
  const total = costs.reduce((a, b) => a + b, 0);

  return {
    perDay: [...days]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, n]) => ({ day, sessions: n })),
    cost: {
      sessions: costs.length,
      avgUsd: round(costs.length ? total / costs.length : 0),
      p95Usd: round(percentile(costs, 0.95)),
      totalUsd: round(total),
    },
    byStep: [...steps]
      .map(([step, s]) => ({
        step,
        calls: s.calls,
        usd: round(s.usd),
        avgMs: Math.round(s.ms / s.calls),
      }))
      .sort((a, b) => b.usd - a.usd || a.step.localeCompare(b.step)),
    cacheHitRate: prompt ? round(cached / prompt, 4) : 0,
    funnel: {
      started: sessions.length,
      finishedGrilling: sessions.filter((s) => PAST_GRILLING.includes(s.act)).length,
      reachedVerdict: sessions.filter((s) => AT_VERDICT.includes(s.act)).length,
      madeShareable: sessions.filter((s) => s.shareable === true).length,
    },
  };
}
