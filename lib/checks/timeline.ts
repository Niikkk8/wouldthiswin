// F14: timeline and team signals. Private, and framed as what a judge might ask, never as an
// accusation: plenty of honest teams prepare before the start or push a final fix late.

import { copy, fill } from "../copy";
import type { Finding } from "../findings";

export type CommitLite = { sha: string; date: string; author: string };
export type EventWindow = { start: string | null; end: string | null };

const T = copy.checks.timeline;
const HOUR = 3_600_000;

function finding(id: string, title: string, detail: string, shas: string[]): Finding {
  return {
    id,
    check: "timeline",
    outcome: "warn",
    severity: "minor",
    title,
    detail,
    evidence: shas.slice(0, 3).map((sha) => ({ kind: "commit" as const, sha })),
    fix: null,
    effort: null,
    visibility: "private",
  };
}

/**
 * Commits outside the event window, how the work splits across people, and a team project
 * with one committer. A single commit before the start is a setup or template commit and
 * doesn't count.
 */
export function timelineFindings(
  commits: readonly CommitLite[],
  window: EventWindow | null,
  teamProject: boolean,
): Finding[] {
  const out: Finding[] = [];
  const dated = commits.filter((c) => Number.isFinite(Date.parse(c.date)));
  if (window?.start) {
    const before = dated.filter((c) => Date.parse(c.date) < Date.parse(window.start!));
    if (before.length > 1)
      out.push(
        finding(
          "timeline-before",
          fill(T.before, { n: before.length, s: before.length === 1 ? "" : "s" }),
          T.beforeDetail,
          before.map((c) => c.sha),
        ),
      );
  }
  if (window?.end) {
    const end = Date.parse(window.end);
    const after = dated.filter((c) => Date.parse(c.date) > end);
    if (after.length) {
      const hours = Math.max(
        1,
        Math.round((Math.max(...after.map((c) => Date.parse(c.date))) - end) / HOUR),
      );
      out.push(
        finding(
          "timeline-after",
          fill(T.after, { n: after.length, s: after.length === 1 ? "" : "s" }),
          fill(T.afterDetail, { hours }),
          after.map((c) => c.sha),
        ),
      );
    }
  }
  const byAuthor = new Map<string, number>();
  for (const c of dated)
    if (c.author)
      byAuthor.set(c.author.toLowerCase(), (byAuthor.get(c.author.toLowerCase()) ?? 0) + 1);
  if (teamProject && byAuthor.size === 1 && dated.length >= 3) {
    out.push(
      finding(
        "timeline-one-author",
        fill(T.oneAuthor, { n: dated.length }),
        T.oneAuthorDetail,
        dated.map((c) => c.sha),
      ),
    );
  } else if (byAuthor.size > 1 && dated.length >= 5) {
    const [top, n] = [...byAuthor].sort((a, b) => b[1] - a[1])[0];
    const share = Math.round((n / dated.length) * 100);
    if (share >= 85)
      out.push(
        finding(
          "timeline-split",
          fill(T.split, { share }),
          fill(T.splitDetail, { author: top, share }),
          [],
        ),
      );
  }
  return out.map((f) =>
    f.evidence.length ? f : { ...f, evidence: [{ kind: "check", detail: T.checked }] },
  );
}

/** The share of commits per author, for the owner's own view. */
export function commitShare(commits: readonly CommitLite[]): { author: string; share: number }[] {
  const by = new Map<string, number>();
  for (const c of commits) if (c.author) by.set(c.author, (by.get(c.author) ?? 0) + 1);
  return [...by]
    .map(([author, n]) => ({ author, share: Math.round((n / commits.length) * 100) }))
    .sort((a, b) => b.share - a.share);
}
