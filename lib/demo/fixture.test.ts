import assert from "node:assert/strict";
import { test } from "vitest";
import { currentOdds, START_ODDS } from "../odds";
import { reviewOf } from "../review";
import { toView } from "../session";
import { DEMO_ANSWERS, demoState } from "./fixture";
import { demoTransport } from "./transport";

test("the sample session's odds go 50, 34, 39, 41, 37", () => {
  const scanned = demoState("scanned");
  const answered = demoState("answered");
  const after = answered.events.slice(scanned.events.length).map((e) => e.after);
  assert.deepEqual([START_ODDS, currentOdds(scanned.events), ...after], [50, 34, 39, 41, 37]);
});

test("every stage of the sample session is reachable, and the review comes out", () => {
  for (const at of [
    "start",
    "scanned",
    "grilling",
    "asking",
    "answered",
    "deliberation",
    "deliberated",
    "verdict",
    "share",
  ] as const) {
    assert.doesNotThrow(() => demoState(at), at);
  }
  const r = reviewOf(demoState("verdict"))!;
  assert.equal(r.odds, 37);
  assert.equal(r.readyToWin, false);
  assert.equal(r.comments.length, 3);
});

test("the demo transport plays a whole session without touching the network", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("the demo made a request");
  };
  try {
    const t = demoTransport(demoState("start"), {
      timings: { scanStepMs: 0, thinkMs: 0, deliberateMs: 0 },
    });
    const progress: string[] = [];
    const ok = async (p: Promise<{ status: number; body: Record<string, unknown> }>) =>
      assert.equal((await p).status, 200);
    await ok(t("x", { action: "scan" }, (p) => progress.push(p.type)));
    assert.ok(progress.includes("claims") && progress.includes("checking"));
    await ok(t("x", { action: "advance", from: "scan" }));
    for (let i = 0; i < DEMO_ANSWERS.length; i++) {
      await ok(t("x", { action: "show", question: i }));
      await ok(t("x", { action: "answer", question: i, text: DEMO_ANSWERS[i].text }));
    }
    await ok(t("x", { action: "advance", from: "grilling" }));
    await ok(t("x", { action: "deliberate" }));
    await ok(t("x", { action: "advance", from: "deliberation" }));
    const last = await t("x", { action: "advance", from: "verdict" });
    const view = last.body.view as ReturnType<typeof toView>;
    assert.equal(view.act, "share");
    assert.equal(view.odds, 37);
  } finally {
    globalThis.fetch = real;
  }
});

test("the sample review carries its scored rubric, and a public review never a private finding", () => {
  const s = demoState("verdict");
  const owner = reviewOf({ ...s, signals: { ...s.signals!, bulkFirstCommit: true } }, "owner")!;
  const pub = reviewOf({ ...s, signals: { ...s.signals!, bulkFirstCommit: true } }, "public")!;
  assert.equal(owner.rubric?.criteria.length, 5);
  assert.equal(owner.rubric?.delta, 0);
  assert.ok(owner.findings.some((f) => f.visibility === "private"));
  assert.ok(pub.findings.every((f) => f.visibility === "public"));
});
