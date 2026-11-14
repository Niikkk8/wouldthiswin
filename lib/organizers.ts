// For hackathon organizers: the "add your hackathon" request, and an event's anonymous stats
// behind a secret link. Stats never carry repo names or anything private.

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { findingsOf } from "./findings";
import { currentOdds } from "./odds";
import type { SessionState } from "./session";

export const OrganizerRequest = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(300),
  startsAt: z.string().max(40).optional().default(""),
  endsAt: z.string().max(40).optional().default(""),
  rubric: z.string().trim().max(3000).optional().default(""),
  tracks: z.string().trim().max(2000).optional().default(""),
  contact: z.string().trim().min(3).max(200),
});
export type OrganizerRequest = z.infer<typeof OrganizerRequest>;

type Env = Record<string, string | undefined>;

/** The key in an event's stats link: an HMAC of its slug, so one link can't open another event. */
export function statsKey(slug: string, env: Env = process.env): string | null {
  const secret = env.EVENT_STATS_SECRET;
  return secret
    ? createHmac("sha256", secret).update(`event-stats:${slug}`).digest("base64url").slice(0, 32)
    : null;
}

export function statsKeyValid(
  slug: string,
  key: string | undefined,
  env: Env = process.env,
): boolean {
  const want = statsKey(slug, env);
  if (!want || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type EventStats = {
  sessions: number;
  finished: number;
  averageOdds: number | null;
  /** Problem finding types, most common first, by how many sessions had one. */
  topFindings: { check: string; sessions: number }[];
};

type StatsRow = Pick<SessionState, "act" | "events" | "claims" | "signals">;

/** Counts and averages over an event's sessions. Public findings only; no repo names in, none out. */
export function eventStats(rows: readonly StatsRow[]): EventStats {
  const finished = rows.filter((r) => r.act === "verdict" || r.act === "share");
  const odds = finished.map((r) => currentOdds(r.events));
  const counts = new Map<string, number>();
  for (const r of rows) {
    const checks = new Set(
      findingsOf({ claims: r.claims, signals: r.signals })
        .filter((f) => f.visibility === "public" && f.outcome !== "pass")
        .map((f) => f.check),
    );
    for (const c of checks) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return {
    sessions: rows.length,
    finished: finished.length,
    averageOdds: odds.length ? Math.round(odds.reduce((a, b) => a + b, 0) / odds.length) : null,
    topFindings: [...counts]
      .map(([check, sessions]) => ({ check, sessions }))
      .sort((a, b) => b.sessions - a.sessions || a.check.localeCompare(b.check))
      .slice(0, 8),
  };
}
