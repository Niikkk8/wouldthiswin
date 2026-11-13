import assert from "node:assert/strict";
import { test } from "vitest";
import { cutoffs, forgetAnswers } from "./retention";
import type { Panel } from "./session";

const panel: Panel = {
  chat: [{ judge: "tired", text: "about your answer" }],
  oneLiner: "the one that texts you",
  fixes: ["a", "b", "c"],
  reviews: {
    tired: { status: "commented", comment: null },
    investor: { status: "approved", comment: null },
    engineer: { status: "changesRequested", comment: { file: "a.ts", excerpt: "x", startLine: 1, body: "b" } },
  },
};

test("after 30 days the answer text and the chat go; scores and the review stay", () => {
  const out = forgetAnswers({
    answers: [
      { text: "We send SMS via Twilio.", receivedAt: 1, silent: false, late: false, score: 7, reason: "ok" },
      { text: "", receivedAt: 2, silent: true, late: true, score: -12, reason: "Answered after the buzzer" },
    ],
    panel,
  });
  assert.deepEqual(out.answers.map((a) => [a.text, a.score, a.silent]), [["", 7, false], ["", -12, true]]);
  assert.deepEqual(out.panel?.chat, []);
  assert.equal(out.panel?.oneLiner, "the one that texts you");
  assert.deepEqual(out.panel?.reviews, panel.reviews);
  assert.deepEqual(out.panel?.fixes, panel.fixes);
});

test("cutoffs: 30 days for answers, 1 day for file contents, 24 hours for the old cache, 7 days for findings", () => {
  const now = Date.UTC(2026, 11, 31);
  const c = cutoffs(now);
  assert.equal(c.answers, new Date(Date.UTC(2026, 11, 1)).toISOString());
  assert.equal(c.sources, new Date(Date.UTC(2026, 11, 30)).toISOString());
  assert.equal(c.cache, c.sources);
  assert.equal(c.findings, new Date(Date.UTC(2026, 11, 24)).toISOString());
});
