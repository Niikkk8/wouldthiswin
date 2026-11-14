// Act 4, the code review, built in code from the session. This is also everything the
// public link, the share card and the badge may show: never the answers or the transcript.

import { copy, fill } from "./copy";
import { START_ODDS, anyCoreMissing, currentOdds, readyToWin, tierFor, type Tier } from "./odds";
import type { Iteration } from "./recheck";
import { findingsOf, type Finding } from "./findings";
import { buildPitch, type Pitch } from "./pitch";
import { rubricFor } from "./events";
import { aggregate, rubricDelta, sheetOf, type Criterion, type Rubric, type RubricCriterion, type ScoredCriterion } from "./rubric";
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
  /** The judging sheet: each criterion 1 to 5, by fixed rules (lib/rubric.ts). */
  sheet: Criterion[];
  /** A re-review: last round's fixes, checked against the diff. Null on a first review. */
  iteration: Iteration | null;
  /** Everything found, with evidence. Only public findings ever reach a public review. */
  findings: Finding[];
  /** The scored rubric. Null for reviews written before rubrics existed. */
  rubric: RubricView | null;
  /** The commit the scan read: evidence links point here. */
  commit: string | null;
  eventSlug: string | null;
  shareable: boolean;
  listed: boolean;
  /** The owner's practice notes: each question and what a strong answer would cover. Never public. */
  practice: { judge: Judge; question: string; points: string[] }[];
  /** The owner's honest README skeleton and submission draft. Null on public reviews. */
  pitch: Pitch | null;
};

export type RubricView = {
  criteria: (RubricCriterion & ScoredCriterion)[];
  /** The weighted score, 0 to 10. */
  aggregate: number;
  /** What it moved the odds by (lib/rubric.ts rubricDelta). */
  delta: number;
};

/** Who's looking: the owner sees everything; anyone else sees public findings only. */
export type Audience = "owner" | "public";

function rubricView(criteria: ScoredCriterion[] | undefined, rubric: Rubric, visible: ReadonlySet<string>): RubricView | null {
  if (!criteria?.length) return null;
  const merged = rubric.criteria.flatMap((c) => {
    const s = criteria.find((x) => x.key === c.key);
    return s ? [{ ...c, ...s, findings: s.findings.filter((id) => visible.has(id)) }] : [];
  });
  const agg = aggregate(criteria, rubric);
  return { criteria: merged, aggregate: agg, delta: rubricDelta(agg) };
}

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
    status: c.status === "backed" ? "passed" : c.status === "unbacked" || c.status === "mocked" ? "failed" : "warning",
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
export function reviewOf(s: SessionState, audience: Audience = "public", rubric: Rubric = rubricFor(s.eventSlug)): Review | null {
  const panel = s.panel;
  if (!panel || !panel.reviews) return null;
  const odds = currentOdds(s.events);
  const checks = checksOf(s);
  const summary = { passed: 0, failed: 0, warning: 0 };
  for (const c of checks) summary[c.status]++;
  const missing = anyCoreMissing(s.claims ?? []);
  const all = findingsOf(s);
  const findings = audience === "owner" ? all : all.filter((f) => f.visibility === "public");
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
    sheet: sheetOf(s),
    iteration: s.signals?.iteration ?? null,
    findings,
    rubric: rubricView(panel.criteria, rubric, new Set(findings.map((f) => f.id))),
    commit: s.signals?.commit ?? null,
    eventSlug: s.eventSlug ?? null,
    practice:
      audience === "owner"
        ? s.questions.flatMap((q, i) => {
            const points = panel.strongAnswers?.[i] ?? [];
            return points.length ? [{ judge: q.judge, question: q.text, points }] : [];
          })
        : [],
    pitch: audience === "owner" ? buildPitch({ repo: s.repo, oneLiner: panel.oneLiner, claims: s.claims ?? [], facts: s.signals?.pitch ?? null }) : null,
    shareable: s.visibility?.shareable === true,
    listed: s.visibility?.listed === true,
  };
}
