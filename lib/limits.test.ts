import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { DEFAULT_LIMITS, checkCaps, limitsFromEnv, nextReset, untilReset } from "./limits";

const L = DEFAULT_LIMITS;

describe("limits from the environment", () => {
  test("defaults: 5 per visitor, 300 a day, $20 of spend", () => {
    assert.deepEqual(limitsFromEnv({}), { perUser: 5, perDay: 300, spendUsd: 20 });
  });

  test("set values win; junk, blanks and negatives fall back", () => {
    assert.deepEqual(
      limitsFromEnv({ MAX_SESSIONS_PER_USER_PER_DAY: "2", MAX_SESSIONS_PER_DAY: "40", DAILY_SPEND_LIMIT_USD: "2.5" }),
      { perUser: 2, perDay: 40, spendUsd: 2.5 },
    );
    assert.deepEqual(
      limitsFromEnv({ MAX_SESSIONS_PER_USER_PER_DAY: "lots", MAX_SESSIONS_PER_DAY: " ", DAILY_SPEND_LIMIT_USD: "-1" }),
      L,
    );
  });

  test("zero is a real setting: it closes the doors", () => {
    assert.equal(limitsFromEnv({ MAX_SESSIONS_PER_DAY: "0" }).perDay, 0);
    assert.equal(checkCaps({ user: 0, day: 0, spendUsd: 0 }, { ...L, perDay: 0 }), "dailyCap");
  });
});

describe("caps", () => {
  test("under every cap is ok", () => {
    assert.equal(checkCaps({ user: 4, day: 299, spendUsd: 19.99 }, L), "ok");
  });

  test("each cap trips at its limit, not one past it", () => {
    assert.equal(checkCaps({ user: 5, day: 0, spendUsd: 0 }, L), "rateLimited");
    assert.equal(checkCaps({ user: 0, day: 300, spendUsd: 0 }, L), "dailyCap");
    assert.equal(checkCaps({ user: 0, day: 0, spendUsd: 20 }, L), "spendCap");
  });

  test("site-wide caps are reported before the visitor's own", () => {
    assert.equal(checkCaps({ user: 9, day: 300, spendUsd: 0 }, L), "dailyCap");
    assert.equal(checkCaps({ user: 9, day: 300, spendUsd: 25 }, L), "spendCap");
  });
});

describe("reset", () => {
  test("is the next UTC midnight, even late in the UTC day or across a month", () => {
    assert.equal(nextReset(new Date("2026-11-14T23:59:59Z")).toISOString(), "2026-11-15T00:00:00.000Z");
    assert.equal(nextReset(new Date("2026-11-30T05:00:00Z")).toISOString(), "2026-12-01T00:00:00.000Z");
    assert.equal(nextReset(new Date("2026-11-14T00:00:00Z")).toISOString(), "2026-11-15T00:00:00.000Z");
  });

  test("the countdown rounds up to the minute and never goes negative", () => {
    const reset = new Date("2026-11-15T00:00:00Z");
    assert.deepEqual(untilReset(new Date("2026-11-14T20:47:30Z"), reset), { hours: 3, minutes: 13 });
    assert.deepEqual(untilReset(new Date("2026-11-15T00:00:05Z"), reset), { hours: 0, minutes: 0 });
  });
});
