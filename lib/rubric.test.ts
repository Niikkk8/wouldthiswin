import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { answerScore, iterationScore, sheetOf, technicalScore } from "./rubric";
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
