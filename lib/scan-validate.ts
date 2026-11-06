// Checks the model's scan in code. Nothing it says about the repo is trusted: every path it
// cites is looked up in the real file list, and anything malformed is dropped.

import { z } from "zod";
import { copy, fill } from "./copy";
import { pathExists } from "./file-tree";
import { JUDGES, QUESTION_COUNT, type Claim, type Judge, type Question } from "./session";

export const MAX_CLAIMS = 6;
export const MAX_QUESTION_CHARS = 220;
const MAX_SEARCHED = 3;

// The shape the model is asked for. Kept loose (no length limits) because structured
// output schemas don't enforce them; validateScan does.
const ModelClaim = z.object({
  claim: z.string(),
  weight: z.enum(["core", "minor"]),
  status: z.enum(["backed", "unbacked", "unclear"]),
  file: z.string().nullable(),
  evidence: z.string(),
  label: z.string(),
  missing: z.string().nullable(),
  searched: z.array(z.string()),
});

const ModelQuestion = z.object({ text: z.string(), caught: z.string().nullable() });

export const ScanOutput = z.object({
  claims: z.array(ModelClaim),
  questions: z.object({ engineer: ModelQuestion, investor: ModelQuestion, tired: ModelQuestion }),
});
export type ScanOutput = z.infer<typeof ScanOutput>;

// The same claim with the limits enforced. A claim that fails these is dropped.
const StrictClaim = ModelClaim.extend({
  claim: z.string().trim().min(1).max(120),
  evidence: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(80),
  missing: z.string().trim().max(60).nullable(),
});

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Cleans a model-written path. Returns null for anything that can't be a repo path. */
export function normalizePath(p: string | null): string | null {
  if (!p) return null;
  let s = p.trim().replace(/^[`'"]+|[`'"]+$/g, "");
  s = s.replace(/^\.\//, "").replace(/^\/+/, "");
  if (!s || s.length > 200 || s.split("/").includes("..") || /[\0\r\n]/.test(s)) return null;
  return s;
}

export type ValidScan = { claims: Claim[]; questions: Omit<Question, "issuedAt">[] };

export type ScanCheck =
  | { ok: true; scan: ValidScan; dropped: number; downgraded: number }
  | { ok: false; reason: string };

/**
 * Validates the model's output against the real file list.
 * - A claim that fails the schema is dropped. At most 6 are kept.
 * - "backed" must cite a path that exists, or it becomes "unclear".
 * - Unbacked claims cite no file; their "searched" list keeps only real paths.
 * - Every judge needs a question of at most 220 characters, or the whole scan fails (and is retried).
 */
export function validateScan(output: unknown, files: readonly string[]): ScanCheck {
  const top = z
    .object({ claims: z.array(z.unknown()), questions: z.record(z.string(), z.unknown()) })
    .safeParse(output);
  if (!top.success) return { ok: false, reason: "shape" };

  const fileSet = new Set(files);
  const exists = (p: string | null) => p !== null && pathExists(fileSet, p);

  let dropped = 0;
  let downgraded = 0;
  const claims: Claim[] = [];
  for (const raw of top.data.claims) {
    const parsed = StrictClaim.safeParse(raw);
    if (!parsed.success) {
      dropped++;
      continue;
    }
    if (claims.length >= MAX_CLAIMS) {
      dropped++;
      continue;
    }
    const c = parsed.data;
    const file = normalizePath(c.file);
    const claim = oneLine(c.claim);
    let status = c.status;
    let evidence = oneLine(c.evidence);
    let label = oneLine(c.label);
    let cited: string | null = exists(file) ? file : null;

    if (status === "backed" && !cited) {
      // The model said a file backs this, but no such file exists. Code decides, not the model.
      status = "unclear";
      downgraded++;
      evidence = file
        ? fill(copy.scan.citedMissing, { path: file.slice(0, 80) })
        : copy.scan.citedNothing;
      label = fill(copy.scan.cantVerify, { claim: claim.slice(0, 50) });
    }
    // The model's own evidence says "partly" but its status says "backed": take the weaker one.
    if (status === "backed" && cited && /^partly\b/i.test(evidence)) {
      status = "unclear";
      downgraded++;
    }
    if (status === "unbacked") cited = null;

    const searched =
      status === "unbacked"
        ? [...new Set(c.searched.map(normalizePath))]
            .filter((p): p is string => exists(p))
            .slice(0, MAX_SEARCHED)
        : [];

    claims.push({
      claim,
      status,
      weight: c.weight,
      file: cited,
      evidence,
      label,
      missing: status === "unbacked" && c.missing ? oneLine(c.missing) : null,
      searched,
    });
  }

  const questions: Omit<Question, "issuedAt">[] = [];
  for (const judge of JUDGES) {
    const q = ModelQuestion.safeParse(top.data.questions[judge]);
    if (!q.success) return { ok: false, reason: `question.${judge}` };
    const text = oneLine(q.data.text);
    if (!text || text.length > MAX_QUESTION_CHARS) return { ok: false, reason: `question.${judge}.length` };
    const caught = q.data.caught ? oneLine(q.data.caught) : null;
    questions.push({
      judge: judge as Judge,
      text,
      // The highlight must be a phrase from the question itself.
      // and only part of it: highlighting the whole question highlights nothing.
      caught:
        caught && caught.length <= 80 && caught.length < text.length * 0.6 && text.includes(caught)
          ? caught
          : null,
    });
  }
  if (questions.length !== QUESTION_COUNT) return { ok: false, reason: "questions" };

  return { ok: true, scan: { claims, questions: orderQuestions(questions) }, dropped, downgraded };
}

/** The order judges ask in: the Tired Judge warms up, the Investor, then the Engineer goes for the gap. */
export const ASK_ORDER: readonly Judge[] = ["tired", "investor", "engineer"];

function orderQuestions<T extends { judge: Judge }>(qs: T[]): T[] {
  return [...qs].sort((a, b) => ASK_ORDER.indexOf(a.judge) - ASK_ORDER.indexOf(b.judge));
}
