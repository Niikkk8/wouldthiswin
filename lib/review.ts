// Act 4, the code review, built in code from the session. This is also everything the
// public link, the share card and the badge may show: never the answers or the transcript.

import { copy, fill } from "./copy";
import { START_ODDS, anyCoreMissing, currentOdds, readyToWin, tierFor, type Tier } from "./odds";
import type { Judge, ReviewComment, ReviewStatus, SessionState } from "./session";

export type CheckStatus = "passed" | "failed" | "warning";

export type Check = { status: CheckStatus; title: string; detail: string; file: string | null };

export type Reviewer = { judge: Judge; status: ReviewStatus };

export type Review = {
  id: string;
  repo: string;
  odds: number;
  tier: Tier;
  readyToWin: boolean;
  oneLiner: string;
  checks: Check[];
  summary: Record<CheckStatus, number>;
  reviewers: Reviewer[];
  comments: (ReviewComment & { judge: Judge })[];
  fixes: string[];
  /** The odds after each event, starting at 50: the sparkline. */
  spark: number[];
};

/** Reviewers in the order they asked. */
export const REVIEW_ORDER: readonly Judge[] = ["tired", "investor", "engineer"];

const host = (url: string | null) => {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
};

/** Every claim and signal as a CI-style check. */
export function checksOf(s: Pick<SessionState, "claims" | "signals">): Check[] {
  const checks: Check[] = (s.claims ?? []).map((c) => ({
    status: c.status === "backed" ? "passed" : c.status === "unbacked" ? "failed" : "warning",
    title: c.claim,
    detail: c.evidence,
    file: c.file ?? c.searched[0] ?? null,
  }));
  const demo = s.signals?.demo;
  if (demo) {
    const d = copy.review.checks;
    if (demo.status === "loads") checks.push({ status: "passed", title: d.demoLoads, detail: host(demo.url), file: null });
    else if (demo.status === "video") checks.push({ status: "passed", title: d.demoVideo, detail: host(demo.url), file: null });
    else if (demo.status === "dead") checks.push({ status: "failed", title: d.demoDead, detail: host(demo.url), file: null });
    else checks.push({ status: "warning", title: d.demoNone, detail: d.demoNoneDetail, file: null });
  }
  if (s.signals) {
    const d = copy.review.checks;
    checks.push(
      s.signals.bulkFirstCommit
        ? { status: "failed", title: d.bulkCommit, detail: d.bulkCommitDetail, file: null }
        : { status: "passed", title: d.history, detail: d.historyDetail, file: null },
    );
  }
  return checks;
}

export function summaryLine(summary: Record<CheckStatus, number>): string {
  const parts = [
    fill(copy.review.passed, { n: summary.passed }),
    fill(copy.review.failed, { n: summary.failed }),
    fill(copy.review.warnings, { n: summary.warning, s: summary.warning === 1 ? "" : "s" }),
  ];
  return parts.join(", ");
}

/** The review, once the panel has deliberated. Null before that. */
export function reviewOf(s: SessionState): Review | null {
  const panel = s.panel;
  if (!panel || !panel.reviews) return null;
  const odds = currentOdds(s.events);
  const checks = checksOf(s);
  const summary = { passed: 0, failed: 0, warning: 0 };
  for (const c of checks) summary[c.status]++;
  const missing = anyCoreMissing(s.claims ?? []);
  return {
    id: s.id,
    repo: s.repo,
    odds,
    tier: tierFor(odds),
    readyToWin: readyToWin(odds, s.claims ?? []),
    oneLiner: panel.oneLiner,
    checks,
    summary,
    reviewers: REVIEW_ORDER.map((judge) => ({
      judge,
      // Stored panels are already validated; this holds for older rows too.
      status: judge === "engineer" && missing ? "changesRequested" : panel.reviews[judge].status,
    })),
    comments: REVIEW_ORDER.flatMap((judge) => {
      const c = panel.reviews[judge].comment;
      return c ? [{ ...c, judge }] : [];
    }),
    fixes: panel.fixes,
    spark: [START_ODDS, ...s.events.map((e) => e.after)],
  };
}
