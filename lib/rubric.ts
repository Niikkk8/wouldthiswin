// The judging sheet: the session as a real hackathon score sheet would read it. Most events
// hand judges four or five criteria (technical execution, a working demo, impact, the
// pitch); this scores the ones a repo and three answers can show, 1 to 5, by fixed rules.
// Originality and design aren't on it: nothing here can see them honestly.

import { z } from "zod";
import type { ClaimStatus, ClaimWeight } from "./odds";
import type { Iteration } from "./recheck";
import type { Answer, Judge, Question, ScanSignals } from "./session";

export type CriterionKey = "technical" | "demo" | "impact" | "pitch" | "defense" | "iteration";

/** `basis` names what the score came from, so the sheet never shows a number without a reason. */
export type Criterion = {
  key: CriterionKey;
  score: number;
  basis: BasisKey;
  values?: Record<string, number>;
};

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
export function technicalScore(
  claims: readonly { status: ClaimStatus; weight: ClaimWeight }[],
): number {
  if (!claims.length) return 2;
  let sum = 0;
  let total = 0;
  for (const c of claims) {
    sum += CLAIM_POINTS[c.status] * WEIGHT[c.weight];
    total += WEIGHT[c.weight];
  }
  return Math.round(sum / total);
}

const DEMO_SCORE: Record<ScanSignals["demo"]["status"], number> = {
  loads: 5,
  video: 4,
  none: 2,
  dead: 1,
};

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
  const done = it.fixes.reduce(
    (n, f) => n + (f.status === "addressed" ? 1 : f.status === "partly" ? 0.5 : 0),
    0,
  );
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
      ? {
          key: "technical",
          score: technicalScore(claims),
          basis: "claims",
          values: { backed, total: claims.length },
        }
      : { key: "technical", score: technicalScore(claims), basis: "noClaims" },
  ];
  const demo = s.signals?.demo.status ?? "none";
  const demoBasis = {
    loads: "demoLoads",
    video: "demoVideo",
    none: "demoNone",
    dead: "demoDead",
  } as const;
  sheet.push({ key: "demo", score: DEMO_SCORE[demo], basis: demoBasis[demo] });
  for (const [key, judge] of ANSWER_LINES) {
    const i = s.questions.findIndex((q) => q.judge === judge);
    const a = i >= 0 ? s.answers[i] : undefined;
    if (!a) sheet.push({ key, score: 1, basis: "notAsked" });
    else
      sheet.push({
        key,
        score: answerScore(a.score, a.silent),
        basis: a.silent ? "silent" : "answer",
      });
  }
  const it = s.signals?.iteration;
  if (it) {
    const done = it.fixes.filter((f) => f.status === "addressed").length;
    const started = it.fixes.filter((f) => f.status === "partly").length;
    sheet.push({
      key: "iteration",
      score: iterationScore(it),
      basis: "fixes",
      values: { done, started, total: it.fixes.length },
    });
  }
  return sheet;
}

// The rubric the panel scores (F4). Each criterion gets 0 to 10 from the panel, with a reason
// and the findings it rests on. Code validates every score, clamps it, maps names back to the
// rubric's keys and computes the weighted aggregate; the panel never sets odds. An event can
// bring its own rubric (lib/events); everything else uses DEFAULT_RUBRIC.

export type RubricCriterion = { key: string; name: string; weight: number; description: string };
export type Rubric = { criteria: readonly RubricCriterion[] };

export const DEFAULT_RUBRIC: Rubric = {
  criteria: [
    {
      key: "technical",
      name: "Technical execution",
      weight: 30,
      description:
        "Does the code do what the README says, with real implementations rather than stand-ins?",
    },
    {
      key: "demo",
      name: "Working demo",
      weight: 20,
      description: "A live demo or a video that shows it running.",
    },
    {
      key: "impact",
      name: "Impact",
      weight: 20,
      description: "A named user with a real problem, and who pays for the fix.",
    },
    {
      key: "pitch",
      name: "Pitch",
      weight: 15,
      description: "Can the team say what it is, and for whom, in one sentence?",
    },
    {
      key: "defense",
      name: "Defending the build",
      weight: 15,
      description: "Answers about the code are specific and match the repo.",
    },
  ],
};

export const CRITERION_MAX = 10;

export type ScoredCriterion = {
  key: string;
  /** 0 to 10, an integer. */
  score: number;
  reason: string;
  /** Ids of the findings the score rests on (lib/findings.ts). */
  findings: string[];
  /** "rules" when the panel's scores couldn't be used and fixed rules filled in. */
  source: "panel" | "rules";
};

export const ModelCriterion = z.object({
  criterion: z.string(),
  score: z.number(),
  reason: z.string(),
  findings: z.array(z.string()),
});

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The rubric key a model-written criterion name refers to: its key or its name, any casing or spacing. */
export function canonicalKey(name: string, rubric: Rubric): string | null {
  const n = norm(name);
  return rubric.criteria.find((c) => norm(c.key) === n || norm(c.name) === n)?.key ?? null;
}

const MAX_REASON = 200;
const MAX_CITED = 4;
const HARSH_REASON =
  /\b(un)?backed\b|\bliars?\b|\blying\b|\bfraud\b|\bcheat(ed|ing)?\b|\bdishonest\b|\blazy\b/i;

/**
 * The panel's criterion scores, checked: every criterion in the rubric scored once, each score
 * clamped to 0..10 and rounded, each reason one plain line, each cited finding one that exists.
 * Null if any criterion is missing or unusable, so the caller can retry or fall back.
 */
export function validateCriteria(
  raw: unknown,
  rubric: Rubric,
  findingIds: ReadonlySet<string>,
): ScoredCriterion[] | null {
  const list = z.array(z.unknown()).safeParse(raw);
  if (!list.success) return null;
  const byKey = new Map<string, ScoredCriterion>();
  for (const item of list.data) {
    const c = ModelCriterion.safeParse(item);
    if (!c.success || !Number.isFinite(c.data.score)) continue;
    const key = canonicalKey(c.data.criterion, rubric);
    const reason = c.data.reason.replace(/\s+/g, " ").trim();
    if (
      !key ||
      byKey.has(key) ||
      !reason ||
      reason.length > MAX_REASON ||
      HARSH_REASON.test(reason)
    )
      continue;
    byKey.set(key, {
      key,
      score: Math.min(CRITERION_MAX, Math.max(0, Math.round(c.data.score))),
      reason,
      findings: [...new Set(c.data.findings.filter((id) => findingIds.has(id)))].slice(
        0,
        MAX_CITED,
      ),
      source: "panel",
    });
  }
  const scored = rubric.criteria.map((c) => byKey.get(c.key));
  return scored.every((c): c is ScoredCriterion => !!c) ? scored : null;
}

/**
 * When the panel's scores can't be used after a retry: the fixed-rule judging sheet's 1..5
 * becomes 0..10, and criteria the sheet doesn't cover sit at the midpoint.
 */
export function fallbackCriteria(
  rubric: Rubric,
  sheet: readonly Criterion[],
  reason: string,
): ScoredCriterion[] {
  return rubric.criteria.map((c) => {
    const line = sheet.find((x) => x.key === c.key);
    const score = line
      ? Math.round(((line.score - 1) / (SCALE - 1)) * CRITERION_MAX)
      : CRITERION_MAX / 2;
    return { key: c.key, score, reason, findings: [], source: "rules" };
  });
}

/** The weighted mean of the scores, 0 to 10, to one decimal. Weights needn't sum to anything. */
export function aggregate(scored: readonly ScoredCriterion[], rubric: Rubric): number {
  let sum = 0;
  let total = 0;
  for (const c of rubric.criteria) {
    const s = scored.find((x) => x.key === c.key);
    if (!s || c.weight <= 0) continue;
    sum += s.score * c.weight;
    total += c.weight;
  }
  return total ? Math.round((sum / total) * 10) / 10 : CRITERION_MAX / 2;
}

/**
 * How the rubric moves the final odds: one act 3 event of (aggregate - 5) x 2, rounded. A 5 out
 * of 10 changes nothing; a 10 adds 10 points and a 0 takes 10 away. It sits alongside the scan
 * and grilling events rather than replacing them, so the odds still trace every reason, and it
 * is small enough that the panel's opinion can never outweigh what the code and answers showed.
 */
export const RUBRIC_SWING = 2;

export function rubricDelta(agg: number): number {
  return Math.round((agg - CRITERION_MAX / 2) * RUBRIC_SWING);
}
