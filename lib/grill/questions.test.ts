import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { Finding } from "../findings";
import { buildQuestionsPrompt, routeFindings, validateQuestions } from "./questions";

const q = (text: string, finding: string | null = null) => ({
  text,
  caught: null,
  kind: "fact",
  finding,
});
const finding = (id: string, check: string, title = "t"): Finding => ({
  id,
  check,
  title,
  outcome: "fail",
  severity: "major",
  detail: "d",
  evidence: [{ kind: "file", path: "src/poll.ts", startLine: 3, endLine: 3 }],
  fix: "f",
  effort: "5m",
  visibility: "public",
});

describe("grounded questions", () => {
  test("each judge gets its own findings; passes and secrets go to nobody", () => {
    const r = routeFindings([
      finding("claim-1", "claim", "Real-time updates"),
      finding("claim-2", "claim", "Clinics pay per location"),
      finding("demo-check-1", "demo"),
      finding("readme", "readme"),
      finding("secret-1", "secrets"),
      { ...finding("ai-depth", "ai"), outcome: "pass" },
    ]);
    assert.deepEqual(
      r.engineer.map((f) => f.id),
      ["claim-1", "claim-2"],
    );
    assert.deepEqual(
      r.investor.map((f) => f.id),
      ["claim-2"],
    );
    assert.deepEqual(
      r.tired.map((f) => f.id),
      ["demo-check-1", "readme"],
    );
  });

  test("a question may cite only a finding routed to its own judge", () => {
    const r = validateQuestions(
      {
        questions: {
          engineer: q("Why poll?", "claim-1"),
          investor: q("Who pays?", "claim-1"),
          tired: q("What is it?", "made-up"),
        },
      },
      { engineer: ["claim-1"], investor: [] },
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    const by = Object.fromEntries(r.questions.map((x) => [x.judge, x.findingId]));
    assert.deepEqual(by, { engineer: "claim-1", investor: null, tired: null });
  });

  test("routed findings reach the prompt with where they were found, inside untrusted tags", () => {
    const { user } = buildQuestionsPrompt({
      repo: "t/a",
      description: null,
      claims: [],
      routed: { engineer: [finding("claim-1", "claim", "Real-time")] },
    });
    assert.match(
      user,
      /<untrusted_findings judge="engineer">\n- claim-1: Real-time\. d \(src\/poll\.ts:3\)\n<\/untrusted_findings>/,
    );
  });
});
