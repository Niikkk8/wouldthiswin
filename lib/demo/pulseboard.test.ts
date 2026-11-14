import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "vitest";
import { currentOdds } from "../odds";
import { demoState } from "./fixture";
import { PULSEBOARD } from "./pulseboard";
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
