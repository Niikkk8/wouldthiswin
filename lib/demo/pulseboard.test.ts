import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "vitest";
import { currentOdds } from "../odds";
import { acceptAnswer, issueQuestion, settleAnswer, type Result } from "../session";
import { demoState } from "./fixture";
import { PULSEBOARD, PULSEBOARD_FOLLOWUP } from "./pulseboard";
import { PULSEBOARD_ROUND2 } from "./pulseboard-round2";

describe("the PulseBoard capture fixture", () => {
  test("reaches every act through the real state machine", () => {
    for (const at of ["scanned", "grilling", "answered", "deliberated", "share"] as const)
      assert.ok(demoState(at, Date.now(), PULSEBOARD));
    const odds = currentOdds(demoState("verdict", Date.now(), PULSEBOARD).events);
    assert.ok(odds > 0 && odds < 50, `odds ${odds}`);
  });

  test("the real checks catch what the videos show", () => {
    const titles = (PULSEBOARD.scan.signals.checks ?? []).map((f) => f.title).join("\n");
    assert.match(titles, /OpenAI API key in the repo/);
    assert.match(titles, /\.env is committed/);
    assert.match(titles, /Create Next App/);
    assert.match(titles, /localhost/);
    assert.match(titles, /CrowdNet/);
  });

  test("the key only exists at runtime: nothing key-shaped is in the source", () => {
    const src = readFileSync(new URL("./pulseboard.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /sk-[A-Za-z0-9]{20,}/);
  });

  test("round two re-judges round one: higher odds, fixes resolved, the key still in history", () => {
    const before = currentOdds(demoState("verdict", Date.now(), PULSEBOARD).events);
    const after = demoState("verdict", Date.now(), PULSEBOARD_ROUND2);
    assert.ok(currentOdds(after.events) > before);
    assert.equal(after.signals?.iteration?.previousOdds, before);
    const titles = (after.signals?.checks ?? []).map((f) => f.title).join("\n");
    assert.doesNotMatch(titles, /Create Next App|\.env is committed/);
    assert.match(titles, /still in git history/);
  });
});

describe("the follow-up capture fixture", () => {
  const unwrap = (r: Result) => {
    if (!r.ok) throw new Error(r.error);
    return r.session;
  };

  test("a vague second answer makes the same judge ask its follow-up next", () => {
    let s = demoState("grilling", 0, PULSEBOARD_FOLLOWUP);
    for (let i = 0; i < 3; i++) {
      const a = PULSEBOARD_FOLLOWUP.answers[i];
      s = unwrap(issueQuestion(s, i, 1_000 * i));
      s = unwrap(acceptAnswer(s, i, a.text, 1_000 * i + 500));
      s = unwrap(
        settleAnswer(s, i, { score: a.score, reason: a.reason, followUp: a.followUp ?? null }),
      );
    }
    const followUp = s.questions[2];
    assert.equal(followUp.followUpOf, 1);
    assert.equal(followUp.judge, s.questions[1].judge);
    assert.equal(followUp.text, PULSEBOARD_FOLLOWUP.answers[1].followUp);
    assert.equal(s.questions.length, 4);
  });
});
