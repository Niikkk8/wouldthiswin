import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BULK_FIRST_COMMIT_DELTA,
  START_ODDS,
  claimDelta,
  clampAnswerScore,
  clampOdds,
  currentOdds,
  demoDelta,
  isNotGuilty,
  makeEvent,
  tierFor,
  toneOf,
  type OddsEvent,
} from "./odds";

describe("claim deltas", () => {
  test("core claims", () => {
    assert.equal(claimDelta("backed", "core"), 6);
    assert.equal(claimDelta("unbacked", "core"), -19);
    assert.equal(claimDelta("unclear", "core"), -6);
  });

  test("minor claims move half as much, rounded toward zero", () => {
    assert.equal(claimDelta("backed", "minor"), 3);
    assert.equal(claimDelta("unbacked", "minor"), -9);
    assert.equal(claimDelta("unclear", "minor"), -3);
  });
});

describe("signal deltas", () => {
  test("demo link: loads +5, dead -8, none 0", () => {
    assert.equal(demoDelta("loads"), 5);
    assert.equal(demoDelta("dead"), -8);
    assert.equal(demoDelta("none"), 0);
  });

  test("a bulk first commit costs 10", () => {
    assert.equal(BULK_FIRST_COMMIT_DELTA, -10);
  });
});

describe("answer scores", () => {
  test("pass through inside the range", () => {
    assert.equal(clampAnswerScore(5), 5);
    assert.equal(clampAnswerScore(-12), -12);
    assert.equal(clampAnswerScore(12), 12);
  });

  test("clamp to -12..+12", () => {
    assert.equal(clampAnswerScore(40), 12);
    assert.equal(clampAnswerScore(-99), -12);
  });

  test("round fractions", () => {
    assert.equal(clampAnswerScore(4.6), 5);
  });

  test("anything that isn't a finite number scores 0", () => {
    for (const v of ["12", null, undefined, NaN, Infinity, {}, [7]]) {
      assert.equal(clampAnswerScore(v), 0, String(v));
    }
  });
});

describe("odds", () => {
  test("start at 50", () => {
    assert.equal(START_ODDS, 50);
    assert.equal(currentOdds([]), 50);
  });

  test("clamp to 1..99", () => {
    assert.equal(clampOdds(0), 1);
    assert.equal(clampOdds(-40), 1);
    assert.equal(clampOdds(100), 99);
    assert.equal(clampOdds(150), 99);
    assert.equal(clampOdds(42), 42);
  });

  test("events chain and store the delta actually applied", () => {
    const events: OddsEvent[] = [];
    events.push(makeEvent(events, { act: 1, kind: "claim", status: "unbacked", rawDelta: -19, reason: "a" }));
    assert.deepEqual(events[0], { act: 1, kind: "claim", status: "unbacked", delta: -19, reason: "a", before: 50, after: 31 });
    events.push(makeEvent(events, { act: 2, kind: "answer", rawDelta: 5, reason: "b" }));
    assert.equal(events[1].before, 31);
    assert.equal(events[1].after, 36);
    assert.equal(currentOdds(events), 36);
  });

  test("a delta past the floor is recorded as what it moved", () => {
    let events: OddsEvent[] = [];
    for (let i = 0; i < 3; i++) {
      events = [...events, makeEvent(events, { act: 1, kind: "claim", rawDelta: -19, reason: "x" })];
    }
    // 50 -> 31 -> 12 -> 1 (not -7)
    assert.equal(events[2].after, 1);
    assert.equal(events[2].delta, -11);
  });

  test("never above 99", () => {
    let events: OddsEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events = [...events, makeEvent(events, { act: 2, kind: "answer", rawDelta: 12, reason: "x" })];
    }
    assert.equal(currentOdds(events), 99);
  });
});

describe("verdict tiers", () => {
  const cases: [number, string][] = [
    [99, "winner"],
    [75, "winner"],
    [74, "top3"],
    [55, "top3"],
    [54, "honorable"],
    [30, "honorable"],
    [29, "participating"],
    [1, "participating"],
  ];
  for (const [odds, tier] of cases) {
    test(`${odds} -> ${tier}`, () => assert.equal(tierFor(odds), tier));
  }
});

describe("charge", () => {
  test("not guilty when no core claim is unbacked", () => {
    assert.equal(isNotGuilty([]), true);
    assert.equal(
      isNotGuilty([
        { status: "backed", weight: "core" },
        { status: "unclear", weight: "core" },
        { status: "unbacked", weight: "minor" },
      ]),
      true,
    );
  });

  test("guilty when any core claim is unbacked", () => {
    assert.equal(
      isNotGuilty([
        { status: "backed", weight: "core" },
        { status: "unbacked", weight: "core" },
      ]),
      false,
    );
  });
});

describe("tone", () => {
  test("unclear claims are amber whatever their sign", () => {
    assert.equal(toneOf({ delta: -6, status: "unclear" }), "unclear");
    assert.equal(toneOf({ delta: 6 }), "gain");
    assert.equal(toneOf({ delta: -1 }), "loss");
    assert.equal(toneOf({ delta: 0 }), "flat");
  });
});
