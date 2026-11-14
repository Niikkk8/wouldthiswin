import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { computeStats, percentile, type SessionRow, type UsageRow } from "./stats";

const session = (
  id: string,
  day: string,
  act: SessionRow["act"],
  shareable = false,
): SessionRow => ({
  id,
  created_at: `${day}T10:00:00Z`,
  act,
  shareable,
});

const call = (
  session_id: string | null,
  step: string,
  usd: number,
  tokens: Partial<UsageRow> = {},
): UsageRow => ({
  session_id,
  step,
  model: "claude-haiku-5-5",
  input_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  usd,
  duration_ms: 100,
  ...tokens,
});

describe("percentile", () => {
  test("nearest rank, and zero for nothing", () => {
    assert.equal(percentile([], 0.95), 0);
    assert.equal(percentile([5], 0.95), 5);
    const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(hundred, 0.95), 95);
    assert.equal(percentile([3, 1, 2], 0.5), 2);
  });
});

describe("stats", () => {
  const sessions = [
    session("a", "2026-11-13", "share", true),
    session("b", "2026-11-13", "verdict"),
    session("c", "2026-11-14", "deliberation"),
    session("d", "2026-11-14", "grilling"),
    session("e", "2026-11-14", "scan"),
  ];
  const usage = [
    call("a", "scan.claims", 0.002, { input_tokens: 800, cache_read_tokens: 200 }),
    call("a", "panel", 0.003),
    call("b", "scan.claims", 0.001, { input_tokens: 1000 }),
    call("c", "answer", 0.0005),
    { ...call("a", "scan.github", 0), model: null, input_tokens: 999 },
  ];
  const s = computeStats(sessions, usage);

  test("sessions per UTC day, oldest first", () => {
    assert.deepEqual(s.perDay, [
      { day: "2026-11-13", sessions: 2 },
      { day: "2026-11-14", sessions: 3 },
    ]);
  });

  test("cost per session from logged spend", () => {
    assert.deepEqual(s.cost, { sessions: 3, avgUsd: 0.002167, p95Usd: 0.005, totalUsd: 0.0065 });
  });

  test("cost by step, most expensive first, ties by name", () => {
    assert.deepEqual(
      s.byStep.map((x) => [x.step, x.calls, x.usd]),
      [
        ["panel", 1, 0.003],
        ["scan.claims", 2, 0.003],
        ["answer", 1, 0.0005],
        ["scan.github", 1, 0],
      ],
    );
  });

  test("cache hit rate counts model calls only", () => {
    assert.equal(s.cacheHitRate, 0.1);
  });

  test("the funnel narrows act by act", () => {
    assert.deepEqual(s.funnel, {
      started: 5,
      finishedGrilling: 3,
      reachedVerdict: 2,
      madeShareable: 1,
    });
  });

  test("an empty database is all zeros, not NaN", () => {
    const empty = computeStats([], []);
    assert.deepEqual(empty.cost, { sessions: 0, avgUsd: 0, p95Usd: 0, totalUsd: 0 });
    assert.equal(empty.cacheHitRate, 0);
  });
});
