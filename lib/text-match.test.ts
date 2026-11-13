import assert from "node:assert/strict";
import { test } from "vitest";
import { lineOf, normalizePath, quotedIn } from "./text-match";

test("paths are normalized and traversal is rejected", () => {
  assert.equal(normalizePath("`./src/app.ts`"), "src/app.ts");
  assert.equal(normalizePath("/lib/x.ts"), "lib/x.ts");
  assert.equal(normalizePath("../etc/passwd"), null);
  assert.equal(normalizePath("a/../../b"), null);
  assert.equal(normalizePath("a\0b"), null);
  assert.equal(normalizePath(""), null);
});

test("a quote matches whatever its whitespace, but not with any other character changed", () => {
  const text = "function send() {\n    twilio.messages.create({ to });\n}";
  assert.equal(quotedIn(text, "twilio.messages.create({   to });"), true);
  assert.equal(quotedIn(text, "twilio.messages.create({ to })"), true);
  assert.equal(quotedIn(text, "twilio.message.create({ to });"), false);
  assert.equal(quotedIn(text, "   "), false);
});

test("a one-line quote is placed on its line", () => {
  assert.equal(lineOf("a\nb\n  return Math.random();", "return Math.random();"), 3);
  assert.equal(lineOf("a\nb", "c"), null);
});
