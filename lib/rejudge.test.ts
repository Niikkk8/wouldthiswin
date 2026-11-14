import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { demoState } from "./demo/fixture";
import { rejudgeDelta, snapshotOf } from "./rejudge";
import { reviewOf } from "./review";

describe("re-judge delta", () => {
  const before = demoState("verdict");
  const snapshot = snapshotOf(before);

  test("the snapshot keeps last round's fix items and scores, nothing else", () => {
    assert.ok(snapshot.fixes.length > 0);
    assert.ok(snapshot.fixes.some((f) => f.title === "SMS alerts when your turn is close"));
    assert.deepEqual(
      snapshot.criteria.find((c) => c.key === "technical"),
      { key: "technical", score: 4 },
    );
  });

  test("a fixed claim is resolved, the rest stay open, and moved criteria are listed", () => {
    const fixedSms = {
      ...before,
      claims: before.claims!.map((c) =>
        c.claim.startsWith("SMS")
          ? { ...c, status: "backed" as const, file: "server/notify.ts", searched: [] }
          : c,
      ),
      panel: {
        ...before.panel!,
        criteria: before.panel!.criteria!.map((c) =>
          c.key === "technical" ? { ...c, score: 7 } : c,
        ),
      },
      signals: {
        ...before.signals!,
        iteration: {
          previousId: before.id,
          previousOdds: 34,
          commits: 3,
          filesChanged: 2,
          fixes: [],
          previous: snapshot,
        },
      },
    };
    const d = rejudgeDelta(reviewOf(fixedSms, "owner")!)!;
    assert.equal(d.from, 34);
    assert.ok(d.resolved.includes("SMS alerts when your turn is close"));
    assert.ok(!d.open.includes("SMS alerts when your turn is close"));
    assert.deepEqual(d.moved, [{ key: "technical", name: "Technical execution", from: 4, to: 7 }]);
  });

  test("a first review has no delta", () => {
    assert.equal(rejudgeDelta(reviewOf(before, "owner")!), null);
  });
});
