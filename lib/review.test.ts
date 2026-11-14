import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { checksOf, reviewOf, summaryLine } from "./review";
import { newSession, type Claim, type Panel, type SessionState } from "./session";

const claim = (
  claim: string,
  status: Claim["status"],
  weight: Claim["weight"] = "core",
  over: Partial<Claim> = {},
): Claim => ({
  claim,
  status,
  weight,
  file: status === "backed" ? "lib/queue.ts" : null,
  evidence: `${claim} evidence`,
  label: "l",
  missing: null,
  searched: status === "unbacked" ? ["package.json"] : [],
  ...over,
});

const panel: Panel = {
  chat: [{ judge: "tired", text: "secret chat about the answers" }],
  oneLiner: "the one that texts you",
  fixes: ["a", "b", "c"],
  reviews: {
    tired: { status: "commented", comment: null },
    investor: {
      status: "approved",
      comment: { file: "lib/queue.ts", excerpt: "x", startLine: 4, body: "b" },
    },
    engineer: { status: "approved", comment: null },
  },
};

function session(over: Partial<SessionState> = {}): SessionState {
  return {
    ...newSession("abcdefghij", "late/queue-less"),
    act: "verdict",
    claims: [
      claim("Live queue", "backed"),
      claim("SMS alerts", "unbacked"),
      claim("Any hospital", "unclear", "minor"),
    ],
    signals: {
      demo: { status: "dead", url: "https://queue.vercel.app/x" },
      bulkFirstCommit: false,
    },
    answers: [
      {
        text: "MY SECRET ANSWER",
        receivedAt: 1,
        silent: false,
        late: false,
        score: 5,
        reason: "r",
      },
    ],
    events: [
      { act: 1, kind: "claim", delta: 6, reason: "a", before: 50, after: 56 },
      { act: 2, kind: "answer", delta: -12, reason: "b", before: 56, after: 44 },
    ],
    panel,
    ...over,
  };
}

describe("checks", () => {
  test("every claim and signal, as passed, failed or warning, each with its file", () => {
    const checks = checksOf(session());
    assert.deepEqual(
      checks.map((c) => [c.status, c.title, c.file]),
      [
        ["passed", "Live queue", "lib/queue.ts"],
        ["failed", "SMS alerts", "package.json"],
        ["warning", "Any hospital", null],
        ["failed", "Demo link is dead", null],
        ["passed", "Built across commits", null],
      ],
    );
    assert.equal(checks[3].detail, "queue.vercel.app");
  });

  test("a demo video that resolves passes", () => {
    const checks = checksOf(
      session({
        signals: {
          demo: { status: "video", url: "https://www.loom.com/share/x" },
          bulkFirstCommit: false,
        },
      }),
    );
    assert.deepEqual(
      checks.find((c) => c.title === "Demo video resolves"),
      {
        status: "passed",
        title: "Demo video resolves",
        detail: "www.loom.com",
        file: null,
      },
    );
  });

  test("the summary line", () => {
    assert.equal(
      summaryLine({ passed: 3, failed: 1, warning: 1 }),
      "3 passed, 1 failed, 1 warning",
    );
    assert.equal(
      summaryLine({ passed: 0, failed: 0, warning: 2 }),
      "0 passed, 0 failed, 2 warnings",
    );
  });
});

describe("the review", () => {
  test("status, odds, tier, reviewers, comments, fixes, sparkline", () => {
    const r = reviewOf(session())!;
    assert.equal(r.odds, 44);
    assert.equal(r.tier, "honorable");
    assert.equal(r.readyToWin, false);
    assert.deepEqual(r.summary, { passed: 2, failed: 2, warning: 1 });
    assert.deepEqual(r.spark, [50, 56, 44]);
    assert.deepEqual(
      r.comments.map((c) => [c.judge, c.file, c.startLine]),
      [["investor", "lib/queue.ts", 4]],
    );
  });

  test("the Engineer requests changes when a core claim is missing, even on an older panel", () => {
    const r = reviewOf(session())!;
    assert.deepEqual(
      r.reviewers.map((x) => [x.judge, x.status]),
      [
        ["tired", "commented"],
        ["investor", "approved"],
        ["engineer", "changesRequested"],
      ],
    );
  });

  test("never contains the answers or the chat", () => {
    const json = JSON.stringify(reviewOf(session()));
    assert.doesNotMatch(json, /MY SECRET ANSWER|secret chat/);
  });

  test("no review before the panel has deliberated", () => {
    assert.equal(reviewOf(session({ panel: null })), null);
  });
});
