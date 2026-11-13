import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  DEFAULT_RUBRIC,
  aggregate,
  answerScore,
  canonicalKey,
  fallbackCriteria,
  iterationScore,
  rubricDelta,
  sheetOf,
  technicalScore,
  validateCriteria,
} from "./rubric";
import type { Iteration } from "./recheck";

const it = (statuses: ("addressed" | "partly" | "untouched")[]): Iteration => ({
  previousId: "abcdefghjk",
  previousOdds: 30,
  commits: 4,
  filesChanged: 3,
  fixes: statuses.map((status) => ({ fix: "f", status, file: null, quote: null, note: "n" })),
});

describe("the judging sheet", () => {
  test("technical execution: core claims count double, a mock sits below unclear", () => {
    assert.equal(technicalScore([{ status: "backed", weight: "core" }]), 5);
    assert.equal(technicalScore([{ status: "unbacked", weight: "core" }]), 1);
    assert.equal(technicalScore([{ status: "mocked", weight: "core" }]), 2);
    // (5*2 + 1*1) / 3 = 3.67 -> 4
    assert.equal(technicalScore([{ status: "backed", weight: "core" }, { status: "unbacked", weight: "minor" }]), 4);
    assert.equal(technicalScore([]), 2);
  });

  test("an answer's -12..+12 lands on 1..5; silence is a 1", () => {
    assert.deepEqual([12, 9, 8, 5, 4, 0, -1, -6, -7, -12].map((s) => answerScore(s, false)), [5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
    assert.equal(answerScore(10, true), 1);
  });

  test("acting on feedback: all three done is a 5, none a 1, started is half", () => {
    assert.equal(iterationScore(it(["addressed", "addressed", "addressed"])), 5);
    assert.equal(iterationScore(it(["untouched", "untouched", "untouched"])), 1);
    assert.equal(iterationScore(it(["addressed", "partly", "untouched"])), 3);
  });

  test("every line says where its score came from; the feedback line only on a re-review", () => {
    const base = {
      claims: [{ status: "backed" as const, weight: "core" as const }],
      signals: { demo: { status: "loads" as const, url: "https://x.vercel.app" }, bulkFirstCommit: false },
      questions: [{ judge: "tired" as const }, { judge: "investor" as const }, { judge: "engineer" as const }],
      answers: [
        { score: 8, silent: false },
        { score: -4, silent: false },
        { score: null, silent: true },
      ],
    };
    const sheet = sheetOf(base);
    assert.deepEqual(
      sheet.map((c) => [c.key, c.score, c.basis]),
      [
        ["technical", 5, "claims"],
        ["demo", 5, "demoLoads"],
        ["impact", 2, "answer"],
        ["pitch", 4, "answer"],
        ["defense", 1, "silent"],
      ],
    );
    const again = sheetOf({ ...base, signals: { ...base.signals, iteration: it(["addressed", "addressed", "partly"]) } });
    assert.deepEqual(again.at(-1), { key: "iteration", score: 4, basis: "fixes", values: { done: 2, started: 1, total: 3 } });
  });
});

describe("rubric criteria", () => {
  const ids = new Set(["claim-1", "demo"]);
  const all = (score: number, extra: Record<string, unknown> = {}) =>
    DEFAULT_RUBRIC.criteria.map((c) => ({ criterion: c.key, score, reason: "Because.", findings: ["claim-1"], ...extra }));

  test("names map back to keys, whatever the casing or spacing", () => {
    assert.equal(canonicalKey("Technical Execution", DEFAULT_RUBRIC), "technical");
    assert.equal(canonicalKey("working-demo", DEFAULT_RUBRIC), "demo");
    assert.equal(canonicalKey("PITCH", DEFAULT_RUBRIC), "pitch");
    assert.equal(canonicalKey("originality", DEFAULT_RUBRIC), null);
  });

  test("scores are clamped to 0..10 and rounded", () => {
    const out = validateCriteria(all(14), DEFAULT_RUBRIC, ids)!;
    assert.ok(out.every((c) => c.score === 10));
    assert.ok(validateCriteria(all(-3), DEFAULT_RUBRIC, ids)!.every((c) => c.score === 0));
    assert.ok(validateCriteria(all(6.6), DEFAULT_RUBRIC, ids)!.every((c) => c.score === 7));
  });

  test("only findings that exist can be cited", () => {
    const out = validateCriteria(all(5, { findings: ["claim-1", "claim-9", "claim-1", "demo"] }), DEFAULT_RUBRIC, ids)!;
    assert.deepEqual(out[0].findings, ["claim-1", "demo"]);
  });

  test("a missing criterion, a harsh reason or a non-number makes the set unusable", () => {
    assert.equal(validateCriteria(all(5).slice(1), DEFAULT_RUBRIC, ids), null);
    assert.equal(validateCriteria(all(5, { reason: "They're lying about the demo." }), DEFAULT_RUBRIC, ids), null);
    assert.equal(validateCriteria(all(5, { score: "9" }), DEFAULT_RUBRIC, ids), null);
    assert.equal(validateCriteria("nope", DEFAULT_RUBRIC, ids), null);
  });

  test("an extra criterion the rubric doesn't have is ignored", () => {
    const out = validateCriteria([...all(5), { criterion: "vibes", score: 10, reason: "r", findings: [] }], DEFAULT_RUBRIC, ids);
    assert.equal(out?.length, DEFAULT_RUBRIC.criteria.length);
  });

  test("the aggregate is the weighted mean", () => {
    const scored = DEFAULT_RUBRIC.criteria.map((c) => ({ key: c.key, score: c.key === "technical" ? 10 : 0, reason: "r", findings: [], source: "panel" as const }));
    assert.equal(aggregate(scored, DEFAULT_RUBRIC), 3);
  });

  test("odds mapping: 5 changes nothing, 10 adds 10, 0 takes 10", () => {
    assert.equal(rubricDelta(5), 0);
    assert.equal(rubricDelta(10), 10);
    assert.equal(rubricDelta(0), -10);
    assert.equal(rubricDelta(7.3), 5);
  });

  test("the fallback turns the 1..5 sheet into 0..10 and marks it as rules", () => {
    const sheet = sheetOf({ claims: [{ status: "backed", weight: "core" }], signals: null, questions: [], answers: [] });
    const out = fallbackCriteria(DEFAULT_RUBRIC, sheet, "rules");
    assert.equal(out.find((c) => c.key === "technical")?.score, 10);
    assert.equal(out.find((c) => c.key === "demo")?.score, 3);
    assert.ok(out.every((c) => c.source === "rules"));
  });
});
