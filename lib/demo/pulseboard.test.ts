import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "vitest";
import { currentOdds } from "../odds";
import { demoState } from "./fixture";
import { PULSEBOARD } from "./pulseboard";

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
});
