import assert from "node:assert/strict";
import { test } from "vitest";
import { displayTree, pathExists, treeCompare } from "./file-tree";

const files = [
  "README.md",
  "package.json",
  "app/api/queue/route.ts",
  "app/page.tsx",
  "lib/queue.ts",
  "lib/supabase.ts",
  "lib/sms-stub.ts",
  "config/hospital.ts",
];

test("tree order puts folders first and a folder before its contents", () => {
  const sorted = ["README.md", "lib/queue.ts", "lib/", "app/", "package.json"].sort(treeCompare);
  assert.deepEqual(sorted, ["app/", "lib/", "lib/queue.ts", "package.json", "README.md"]);
});

test("paths exist as files or as folders that contain files", () => {
  assert.equal(pathExists(files, "lib/queue.ts"), true);
  assert.equal(pathExists(files, "lib/"), true);
  assert.equal(pathExists(files, "lib"), true);
  assert.equal(pathExists(files, "li"), false);
  assert.equal(pathExists(files, "lib/twilio.ts"), false);
});

test("display tree keeps cited files and their folders", () => {
  const tree = displayTree(files, [
    { file: "lib/queue.ts", searched: [] },
    { file: null, searched: ["package.json", "lib/"] },
    { file: "config/hospital.ts", searched: [] },
  ]);
  for (const p of ["lib/", "lib/queue.ts", "config/", "config/hospital.ts", "package.json"]) {
    assert.ok(tree.includes(p), p);
  }
  assert.deepEqual([...tree].sort(treeCompare), tree);
});

test("OS clutter stays out of the display tree", () => {
  const tree = displayTree(
    [...files, ".DS_Store", "lib/.DS_Store"],
    [{ file: "lib/queue.ts", searched: [] }],
  );
  assert.ok(!tree.some((p) => p.endsWith(".DS_Store")));
});
