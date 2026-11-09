// The judging sheet: the session as a real hackathon score sheet would read it. Most events
// hand judges four or five criteria (technical execution, a working demo, impact, the
// pitch); this scores the ones a repo and three answers can show, 1 to 5, by fixed rules.
// Originality and design aren't on it: nothing here can see them honestly.

import type { ClaimStatus, ClaimWeight } from "./odds";
import type { Iteration } from "./recheck";
import type { Answer, Judge, Question, ScanSignals } from "./session";

export type CriterionKey = "technical" | "demo" | "impact" | "pitch" | "defense" | "iteration";

/** `basis` names what the score came from, so the sheet never shows a number without a reason. */
export type Criterion = { key: CriterionKey; score: number; basis: BasisKey; values?: Record<string, number> };

export type BasisKey =
  | "claims"
  | "noClaims"
  | "demoLoads"
  | "demoVideo"
  | "demoNone"
  | "demoDead"
  | "answer"
  | "silent"
  | "notAsked"
  | "fixes";

export const SCALE = 5;

// One claim's worth on the technical line. Mocked sits below unclear: the code shows a
// stand-in, which judges read as "only works with pre-loaded data".
const CLAIM_POINTS: Record<ClaimStatus, number> = { backed: 5, unclear: 3, mocked: 2, unbacked: 1 };
const WEIGHT: Record<ClaimWeight, number> = { core: 2, minor: 1 };

/** Core claims count double. No checkable claims is a 2: the README gave the judges nothing to check. */
export function technicalScore(claims: readonly { status: ClaimStatus; weight: ClaimWeight }[]): number {
  if (!claims.length) return 2;
  let sum = 0;
  let total = 0;
  for (const c of claims) {
    sum += CLAIM_POINTS[c.status] * WEIGHT[c.weight];
    total += WEIGHT[c.weight];
  }
  return Math.round(sum / total);
}

const DEMO_SCORE: Record<ScanSignals["demo"]["status"], number> = { loads: 5, video: 4, none: 2, dead: 1 };

/** An answer's score (-12..+12) on the 1-5 line. Silence is a 1. */
export function answerScore(score: number | null, silent: boolean): number {
  if (silent || score === null) return 1;
  if (score >= 9) return 5;
  if (score >= 5) return 4;
  if (score >= 0) return 3;
  if (score >= -6) return 2;
  return 1;
}

/** Done is worth 1, started half. Three of three done is a 5; none of them a 1. */
export function iterationScore(it: Iteration): number {
  if (!it.fixes.length) return 3;
  const done = it.fixes.reduce((n, f) => n + (f.status === "addressed" ? 1 : f.status === "partly" ? 0.5 : 0), 0);
  return 1 + Math.round((done / it.fixes.length) * (SCALE - 1));
}

// Which judge's question each answer line comes from.
const ANSWER_LINES: [CriterionKey, Judge][] = [
  ["impact", "investor"],
  ["pitch", "tired"],
  ["defense", "engineer"],
];

export function sheetOf(s: {
  claims: readonly { status: ClaimStatus; weight: ClaimWeight }[] | null;
  signals: ScanSignals | null;
  questions: readonly Pick<Question, "judge">[];
  answers: readonly Pick<Answer, "score" | "silent">[];
}): Criterion[] {
  const claims = s.claims ?? [];
  const backed = claims.filter((c) => c.status === "backed").length;
  const sheet: Criterion[] = [
    claims.length
      ? { key: "technical", score: technicalScore(claims), basis: "claims", values: { backed, total: claims.length } }
      : { key: "technical", score: technicalScore(claims), basis: "noClaims" },
  ];
  const demo = s.signals?.demo.status ?? "none";
  const demoBasis = { loads: "demoLoads", video: "demoVideo", none: "demoNone", dead: "demoDead" } as const;
  sheet.push({ key: "demo", score: DEMO_SCORE[demo], basis: demoBasis[demo] });
  for (const [key, judge] of ANSWER_LINES) {
    const i = s.questions.findIndex((q) => q.judge === judge);
    const a = i >= 0 ? s.answers[i] : undefined;
    if (!a) sheet.push({ key, score: 1, basis: "notAsked" });
    else sheet.push({ key, score: answerScore(a.score, a.silent), basis: a.silent ? "silent" : "answer" });
  }
  const it = s.signals?.iteration;
  if (it) {
    const done = it.fixes.filter((f) => f.status === "addressed").length;
    const started = it.fixes.filter((f) => f.status === "partly").length;
    sheet.push({ key: "iteration", score: iterationScore(it), basis: "fixes", values: { done, started, total: it.fixes.length } });
  }
  return sheet;
}
