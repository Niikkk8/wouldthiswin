// A re-judge, compared with the round before: the odds then and now, which fix items from
// last time are gone, and which rubric criteria moved. Pure: the snapshot of the previous
// round is taken when the re-judge starts (lib/run-scan.ts) and stored with the iteration.

import { findingsOf } from "./findings";
import { fixItems } from "./fix-list";
import type { Review } from "./review";
import type { SessionState } from "./session";

/** What a re-judge remembers of the round before. */
export type PreviousRound = {
  fixes: { id: string; title: string }[];
  criteria: { key: string; score: number }[];
};

export function snapshotOf(s: SessionState): PreviousRound {
  const fixes = fixItems(findingsOf(s), s.repo, s.signals?.commit ?? null).map((f) => ({
    id: f.id,
    title: f.title,
  }));
  const criteria = (s.panel?.criteria ?? []).map((c) => ({ key: c.key, score: c.score }));
  return { fixes, criteria };
}

export type RejudgeDelta = {
  from: number;
  to: number;
  /** Last round's fix items that no longer appear. */
  resolved: string[];
  /** Last round's fix items still on the list. */
  open: string[];
  /** Criteria whose score changed, biggest move first. */
  moved: { key: string; name: string; from: number; to: number }[];
};

// Claim ids are renumbered every scan, so a fix item is matched by what it says.
const key = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function rejudgeDelta(
  r: Pick<Review, "odds" | "iteration" | "findings" | "repo" | "commit" | "rubric">,
): RejudgeDelta | null {
  const it = r.iteration;
  if (!it) return null;
  const now = new Set(fixItems(r.findings, r.repo, r.commit).map((f) => key(f.title)));
  const before = it.previous?.fixes ?? [];
  const moved = (r.rubric?.criteria ?? [])
    .flatMap((c) => {
      const prev = it.previous?.criteria.find((p) => p.key === c.key);
      return prev && prev.score !== c.score
        ? [{ key: c.key, name: c.name, from: prev.score, to: c.score }]
        : [];
    })
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
  return {
    from: it.previousOdds,
    to: r.odds,
    resolved: before.filter((f) => !now.has(key(f.title))).map((f) => f.title),
    open: before.filter((f) => now.has(key(f.title))).map((f) => f.title),
    moved,
  };
}
