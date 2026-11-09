// Checks the model's scan in code. Nothing it says about the repo is trusted: candidate
// files must exist, "backed" and "mocked" need a line found verbatim in a file that was
// actually read, and "unbacked" needs every file it would live in to have been read in
// full. Code writes every "couldn't find" finding, so users see evidence, never a verdict word.

import { z } from "zod";
import { copy, fill } from "./copy";
import type { ClaimWeight } from "./odds";
import { JUDGES, QUESTION_COUNT, type Claim, type Judge, type Question } from "./session";
import type { Source } from "./sources";

export const MAX_CLAIMS = 6;
export const MAX_CANDIDATES = 2;
export const MAX_QUOTE = 120;
export const MAX_QUESTION_CHARS = 220;

// Call A: claims and where each would live. Kept loose; validateClaims enforces limits.
const ModelCandidate = z.object({
  claim: z.string(),
  weight: z.enum(["core", "minor"]),
  candidates: z.array(z.string()),
});
export const ClaimsOutput = z.object({ claims: z.array(ModelCandidate) });

// Call B: a verdict per claim (by 1-based id) and the questions.
const ModelVerdict = z.object({
  id: z.number(),
  status: z.enum(["backed", "mocked", "unbacked", "unclear"]),
  file: z.string().nullable(),
  quote: z.string().nullable(),
  evidence: z.string(),
  label: z.string(),
  missing: z.string().nullable(),
});
const ModelQuestion = z.object({ text: z.string(), caught: z.string().nullable() });
export const VerifyOutput = z.object({
  verdicts: z.array(ModelVerdict),
  questions: z.object({ engineer: ModelQuestion, investor: ModelQuestion, tired: ModelQuestion }),
});

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Cleans a model-written path. Returns null for anything that can't be a repo path. */
export function normalizePath(p: string | null): string | null {
  if (!p) return null;
  let s = p.trim().replace(/^[`'"]+|[`'"]+$/g, "");
  s = s.replace(/^\.\//, "").replace(/^\/+/, "");
  if (!s || s.length > 200 || s.split("/").includes("..") || /[\0\r\n]/.test(s)) return null;
  return s;
}

/**
 * True if `quote` appears in `text`, character for character except that any run of
 * whitespace matches any other (models re-indent and collapse spaces when they copy a line).
 */
export function quotedIn(text: string, quote: string): boolean {
  const squash = (s: string) => s.replace(/\s+/g, " ").trim();
  const q = squash(quote);
  return q.length > 0 && squash(text).includes(q);
}

export type Candidate = { claim: string; weight: ClaimWeight; candidates: string[] };

export type ClaimsCheck =
  | { ok: true; claims: Candidate[]; dropped: number }
  | { ok: false; reason: string };

/** Call A: at most 6 claims, each with at most 2 candidate files that exist in the repo. */
export function validateClaims(output: unknown, files: readonly string[]): ClaimsCheck {
  const top = z.object({ claims: z.array(z.unknown()) }).safeParse(output);
  if (!top.success) return { ok: false, reason: "shape" };
  const fileSet = new Set(files);
  let dropped = 0;
  const claims: Candidate[] = [];
  for (const raw of top.data.claims) {
    const c = ModelCandidate.safeParse(raw);
    const text = c.success ? oneLine(c.data.claim) : "";
    if (!c.success || !text || text.length > 120 || claims.length >= MAX_CLAIMS) {
      dropped++;
      continue;
    }
    const candidates = [...new Set(c.data.candidates.map(normalizePath))]
      .filter((p): p is string => p !== null && fileSet.has(p))
      .slice(0, MAX_CANDIDATES);
    claims.push({ claim: text, weight: c.data.weight, candidates });
  }
  return { ok: true, claims, dropped };
}

// Words that judge instead of describe. A model label using one is replaced by code's own.
const VERDICT_WORDS =
  /\b(un)?backed\b|\bnot backed\b|\bunsupported\b|\blie[sd]?\b|\blying\b|\bfake[ds]?\b|\bdishonest\b|\bpretend(s|ing)?\b|\bbluff(s|ing)?\b|\bmislead(s|ing)?\b|\bfraud\b/i;

/** "a or b", "a, b or c". */
export function joinPaths(paths: readonly string[]): string {
  if (paths.length <= 1) return paths[0] ?? "";
  return `${paths.slice(0, -1).join(", ")} or ${paths.at(-1)}`;
}

export type ValidScan = { claims: Claim[]; questions: Omit<Question, "issuedAt">[] };

export type ScanCheck =
  | { ok: true; scan: ValidScan; downgraded: number }
  | { ok: false; reason: string };

/**
 * Call B, checked against what was actually read:
 * - "backed" and "mocked" must name a file that was read and quote a line (at most 120
 *   characters) found in it verbatim. Otherwise "unclear".
 * - "unbacked" needs every candidate file of the claim to have been read, none of them cut
 *   off: a missing line in a truncated file proves nothing. Otherwise "unclear".
 * - A claim with no verdict is "unclear".
 * - Every judge needs a question of at most 220 characters, or the whole call fails (and is retried).
 */
export function validateVerify(
  output: unknown,
  candidates: readonly Candidate[],
  sources: readonly Source[],
): ScanCheck {
  const top = z
    .object({ verdicts: z.array(z.unknown()), questions: z.record(z.string(), z.unknown()) })
    .safeParse(output);
  if (!top.success) return { ok: false, reason: "shape" };

  const read = new Map(sources.map((s) => [s.path, s.text]));
  const cutOff = new Set(sources.filter((s) => s.truncated).map((s) => s.path));
  const verdicts = new Map<number, z.infer<typeof ModelVerdict>>();
  for (const v of top.data.verdicts) {
    const p = ModelVerdict.safeParse(v);
    if (p.success && !verdicts.has(p.data.id)) verdicts.set(p.data.id, p.data);
  }

  let downgraded = 0;
  const claims: Claim[] = candidates.map((c, i) => {
    const v = verdicts.get(i + 1);
    const readHere = c.candidates.filter((p) => read.has(p));
    const name = clip(c.claim, 50);
    const unclear = (evidence: string, file: string | null = null): Claim => ({
      claim: c.claim,
      weight: c.weight,
      status: "unclear",
      file,
      evidence,
      label: fill(copy.scan.cantVerify, { claim: name }),
      missing: null,
      searched: [],
      quote: null,
    });

    if (!v) {
      downgraded++;
      return unclear(readHere.length ? copy.scan.notConfirmed : copy.scan.notRead);
    }

    const file = normalizePath(v.file);
    const modelEvidence = clip(oneLine(v.evidence), 160);
    const modelLabel = clip(oneLine(v.label), 80);
    const clean = (s: string) => s && !VERDICT_WORDS.test(s);

    if (v.status === "unbacked") {
      // "Not there" is only a finding if every place it would live was read, all the way down.
      if (!c.candidates.length || readHere.length !== c.candidates.length) {
        downgraded++;
        return unclear(readHere.length ? copy.scan.notAllRead : copy.scan.notRead);
      }
      const partial = readHere.find((p) => cutOff.has(p));
      if (partial) {
        downgraded++;
        return unclear(fill(copy.scan.cutOff, { path: clip(partial, 80) }));
      }
      const missing = clip(oneLine(v.missing ?? "") || c.claim, 60);
      return {
        claim: c.claim,
        weight: c.weight,
        status: "unbacked",
        file: null,
        evidence: fill(copy.scan.notFoundIn, { missing, paths: joinPaths(readHere) }),
        label: clip(fill(copy.scan.notFoundLabel, { missing }), 80),
        missing,
        searched: readHere,
        quote: null,
      };
    }

    if (v.status === "mocked") {
      // A fake is a finding only with the line that shows it, from a file that was read.
      const text = file ? read.get(file) : undefined;
      const quote = (v.quote ?? "").trim();
      if (!file || text === undefined || !quote || quote.length > MAX_QUOTE || !quotedIn(text, quote)) {
        downgraded++;
        return unclear(copy.scan.notConfirmed, file && read.has(file) ? file : null);
      }
      return {
        claim: c.claim,
        weight: c.weight,
        status: "mocked",
        file,
        evidence: clean(modelEvidence) ? modelEvidence : fill(copy.scan.mockedIn, { path: clip(file, 80) }),
        label: clean(modelLabel) ? modelLabel : fill(copy.scan.mockedLabel, { claim: name }),
        missing: null,
        searched: [],
        quote,
      };
    }

    if (v.status === "backed") {
      const text = file ? read.get(file) : undefined;
      if (!file || text === undefined) {
        downgraded++;
        return unclear(file ? fill(copy.scan.citedUnread, { path: clip(file, 80) }) : copy.scan.citedNothing);
      }
      const quote = (v.quote ?? "").trim();
      if (!quote || quote.length > MAX_QUOTE || !quotedIn(text, quote)) {
        downgraded++;
        return unclear(fill(copy.scan.quoteMissing, { path: clip(file, 80) }), file);
      }
      // The model's own evidence says "partly" but its status says "backed": take the weaker one.
      if (/^partly\b/i.test(modelEvidence)) {
        downgraded++;
        return { ...unclear(modelEvidence, file), quote };
      }
      return {
        claim: c.claim,
        weight: c.weight,
        status: "backed",
        file,
        evidence: clean(modelEvidence) ? modelEvidence : fill(copy.scan.foundIn, { path: clip(file, 80) }),
        label: clean(modelLabel) ? modelLabel : fill(copy.scan.foundLabel, { claim: name }),
        missing: null,
        searched: [],
        quote,
      };
    }

    // Unclear: keep the model's file only if it was read.
    const unclearFile = file && read.has(file) ? file : null;
    return {
      ...unclear(clean(modelEvidence) ? modelEvidence : copy.scan.notConfirmed, unclearFile),
      label: clean(modelLabel) ? modelLabel : fill(copy.scan.cantVerify, { claim: name }),
    };
  });

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
      // The highlight must be a phrase from the question itself, and only part of it:
      // highlighting the whole question highlights nothing.
      caught:
        caught && caught.length <= 80 && caught.length < text.length * 0.6 && text.includes(caught)
          ? caught
          : null,
    });
  }
  if (questions.length !== QUESTION_COUNT) return { ok: false, reason: "questions" };

  return { ok: true, scan: { claims, questions: orderQuestions(questions) }, downgraded };
}

/** The order judges ask in: the Tired Judge warms up, the Investor, then the Engineer goes for the gap. */
export const ASK_ORDER: readonly Judge[] = ["tired", "investor", "engineer"];

function orderQuestions<T extends { judge: Judge }>(qs: T[]): T[] {
  return [...qs].sort((a, b) => ASK_ORDER.indexOf(a.judge) - ASK_ORDER.indexOf(b.judge));
}
