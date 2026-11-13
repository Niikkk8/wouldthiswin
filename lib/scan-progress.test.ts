import assert from "node:assert/strict";
import { test } from "vitest";
import { progressLine } from "./scan-progress";

test("each real event has its status line", () => {
  assert.equal(progressLine({ type: "repo", files: 214 }), "Walking 214 files.");
  assert.equal(progressLine({ type: "claims", claims: ["a", "b", "c", "d", "e"] }), "Found 5 claims.");
  assert.equal(progressLine({ type: "claims", claims: ["a"] }), "Found 1 claim.");
  assert.equal(progressLine({ type: "reading", path: "backend/src/utils.js" }), "Reading backend/src/utils.js");
  assert.equal(progressLine({ type: "read", path: "logo.min.js", ok: false }), "Skipped logo.min.js");
  assert.equal(progressLine({ type: "checking", claims: 5 }), "Checking claims against the code.");
});
