import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  BULK_FIRST_COMMIT_DELTA,
  anyCoreMissing,
  fixDelta,
  SCAN_CAP_DOWN,
  SCAN_CAP_UP,
  START_ODDS,
  capScanDelta,
  claimDelta,
  clampAnswerScore,
  clampOdds,
  currentOdds,
  demoDelta,
  readyToWin,
  makeEvent,
  tierFor,
  toneOf,
  type OddsEvent,
} from "./odds";

describe("claim deltas", () => {
  test("core claims", () => {
    assert.equal(claimDelta("backed", "core"), 6);
    assert.equal(claimDelta("unbacked", "core"), -19);
    assert.equal(claimDelta("unclear", "core"), -2);
  });

  test("minor claims move half as much, rounded toward zero", () => {
    assert.equal(claimDelta("backed", "minor"), 3);
    assert.equal(claimDelta("unbacked", "minor"), -9);
  });

  test("unclear means unverified, not false: -2 core, 0 minor", () => {
    assert.equal(claimDelta("unclear", "core"), -2);
    assert.equal(claimDelta("unclear", "minor"), 0);
  });
});

describe("scan cap", () => {
  test("the scan moves the odds by at most +20 / -30", () => {
    assert.equal(SCAN_CAP_UP, 20);
    assert.equal(SCAN_CAP_DOWN, -30);
  });

  test("a delta is cut to what's left of the cap", () => {
    assert.equal(capScanDelta(18, 6), 2);
    assert.equal(capScanDelta(20, 6), 0);
    assert.equal(capScanDelta(-19, -19), -11);
    assert.equal(capScanDelta(-30, -8), 0);
    // Away from the cap it passes through.
    assert.equal(capScanDelta(20, -19), -19);
    assert.equal(capScanDelta(-30, 6), 6);
  });
});

describe("signal deltas", () => {
  test("demo link: loads +8, video +4, dead -8, none 0", () => {
    assert.equal(demoDelta("loads"), 8);
    assert.equal(demoDelta("video"), 4);
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
    events.push(
      makeEvent(events, { act: 1, kind: "claim", status: "unbacked", rawDelta: -19, reason: "a" }),
    );
    assert.deepEqual(events[0], {
      act: 1,
      kind: "claim",
      status: "unbacked",
      delta: -19,
      reason: "a",
      before: 50,
      after: 31,
    });
    events.push(makeEvent(events, { act: 2, kind: "answer", rawDelta: 5, reason: "b" }));
    assert.equal(events[1].before, 31);
    assert.equal(events[1].after, 36);
    assert.equal(currentOdds(events), 36);
  });

  test("a delta past the floor is recorded as what it moved", () => {
    let events: OddsEvent[] = [];
    for (let i = 0; i < 3; i++) {
      events = [
        ...events,
        makeEvent(events, { act: 1, kind: "claim", rawDelta: -19, reason: "x" }),
      ];
    }
    // 50 -> 31 -> 12 -> 1 (not -7)
    assert.equal(events[2].after, 1);
    assert.equal(events[2].delta, -11);
  });

  test("never above 99", () => {
    let events: OddsEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events = [
        ...events,
        makeEvent(events, { act: 2, kind: "answer", rawDelta: 12, reason: "x" }),
      ];
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

describe("review status", () => {
  const coreBacked = { status: "backed", weight: "core" } as const;
  const coreMissing = { status: "unbacked", weight: "core" } as const;
  const minorMissing = { status: "unbacked", weight: "minor" } as const;
  const coreUnclear = { status: "unclear", weight: "core" } as const;

  test("ready to win at 55 or more with no core claim missing", () => {
    assert.equal(readyToWin(55, [coreBacked, coreUnclear, minorMissing]), true);
    assert.equal(readyToWin(99, []), true);
  });

  test("changes requested below 55", () => {
    assert.equal(readyToWin(54, [coreBacked]), false);
  });

  test("changes requested when any core claim is missing, whatever the odds", () => {
    assert.equal(readyToWin(90, [coreBacked, coreMissing]), false);
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

describe("mocked claims and fixes", () => {
  test("a mocked claim costs less than a missing one and more than an unclear one", () => {
    assert.equal(claimDelta("mocked", "core"), -10);
    assert.equal(claimDelta("mocked", "minor"), -5);
  });

  test("a mocked core claim blocks Ready to win, like a missing one", () => {
    assert.equal(anyCoreMissing([{ status: "mocked", weight: "core" }]), true);
    assert.equal(anyCoreMissing([{ status: "mocked", weight: "minor" }]), false);
  });

  test("fixes: done +4, started +2, still open 0", () => {
    assert.deepEqual([fixDelta("addressed"), fixDelta("partly"), fixDelta("untouched")], [4, 2, 0]);
  });
});
