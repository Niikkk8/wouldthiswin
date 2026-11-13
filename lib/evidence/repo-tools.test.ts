import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { ToolSession, type RepoReader } from "./repo-tools";

const FILES: Record<string, string> = {
  "package.json": '{\n  "dependencies": { "next": "16" }\n}',
  "src/predict.ts": "export function predict() {\n  return Math.random();\n}\n",
  "node_modules/x/index.js": "evil",
  "dist/app.min.js": "x",
  "package-lock.json": "{}",
  ".env": "SECRET=1",
};
const repo: RepoReader = { tree: Object.keys(FILES), read: async (p) => FILES[p] ?? null };
const session = (over: Partial<{ calls: number; bytes: number }> = {}, now = () => 0) =>
  new ToolSession(repo, 1000, { calls: over.calls ?? 40, bytes: over.bytes ?? 600 * 1024 }, now);

describe("repo tools", () => {
  test("the tree hides vendored, built, lock and env files", () => {
    assert.deepEqual(session().listTree("").split("\n"), ["package.json", "src/predict.ts"]);
  });

  test("read_file numbers lines and records what was shown", async () => {
    const t = session();
    const out = await t.run("read_file", { path: "src/predict.ts", start: 2, end: 2 });
    assert.match(out, /^src\/predict\.ts lines 2-2 of 4:\n2:   return Math\.random\(\);/);
    assert.equal(t.wasShown("src/predict.ts", 2, 2), true);
    assert.equal(t.wasShown("src/predict.ts", 1, 2), false);
  });

  test("unreadable paths are refused, not read", async () => {
    const t = session();
    assert.match(await t.run("read_file", { path: "node_modules/x/index.js" }), /isn't readable/);
    assert.match(await t.run("read_file", { path: ".env" }), /isn't readable/);
    assert.match(await t.run("read_file", { path: "missing.ts" }), /doesn't exist/);
    assert.equal(t.files.size, 0);
  });

  test("search covers only files already read, and survives a bad regex", async () => {
    const t = session();
    assert.match(t.search("random"), /No files fetched yet/);
    await t.run("read_file", { path: "src/predict.ts" });
    assert.equal(t.search("math.random"), "src/predict.ts:2: return Math.random();");
    assert.match(t.search("["), /No matches/);
  });

  test("read_manifest finds the shallowest manifest", async () => {
    assert.match(await session().run("read_manifest", {}), /^package\.json lines 1-3/);
  });

  test("the budget stops calls by count, bytes and time", async () => {
    const byCount = session({ calls: 1 });
    await byCount.run("list_tree", {});
    assert.match(await byCount.run("list_tree", {}), /Budget exhausted/);
    const byBytes = session({ bytes: 10 });
    await byBytes.run("read_file", { path: "src/predict.ts" });
    assert.equal(byBytes.exhausted, true);
    assert.equal(session({}, () => 5000).exhausted, true);
  });
});
