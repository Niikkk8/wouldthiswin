import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { copy, fill } from "./copy";
import type { Finding } from "./findings";
import { MIN_CELL, aggregate, problemKind, repoUrlsFromCsv, summarize } from "./research";

const finding = (title: string, outcome: Finding["outcome"] = "fail"): Finding => ({
  id: "x",
  check: "x",
  outcome,
  severity: outcome === "pass" ? null : "minor",
  title,
  detail: "",
  evidence: [],
  fix: null,
  effort: null,
  visibility: "public",
});

describe("problem kinds", () => {
  test("come from the title's shape, whatever filled it", () => {
    const C = copy.checks;
    assert.equal(
      problemKind(finding(fill(C.secrets.title, { name: "An API key" }))),
      "secrets.key",
    );
    assert.equal(
      problemKind(finding(fill(C.secrets.historyTitle, { path: ".env" }))),
      "secrets.history",
    );
    assert.equal(
      problemKind(finding(fill(C.template.title, { name: "Create Next App" }))),
      "template.title",
    );
    assert.equal(problemKind(finding(C.hygiene.noTests, "warn")), "hygiene.noTests");
    assert.equal(problemKind(finding(fill(C.demo.status, { status: 500 }))), "demo.status");
  });

  test("passes and unknown titles count as nothing", () => {
    assert.equal(
      problemKind(finding(fill(copy.checks.readme.title, { have: 6, total: 6 }), "pass")),
      null,
    );
    assert.equal(problemKind(finding("Something else")), null);
  });
});

describe("the aggregate", () => {
  const secret = finding(fill(copy.checks.secrets.title, { name: "A key" }));
  const noTests = finding(copy.checks.hygiene.noTests);

  test("counts repos per kind and drops cells too small to be anonymous", () => {
    const repos = [
      ...Array.from({ length: MIN_CELL }, () => summarize([noTests, noTests], "none", true)),
      summarize([secret], "wrapper", false),
      summarize([], "none", false),
    ];
    const a = aggregate(repos, 1, new Date("2026-11-14T00:00:00Z"));
    assert.equal(a.scanned, MIN_CELL + 2);
    assert.equal(a.failed, 1);
    assert.equal(a.clean, 1);
    assert.equal(a.withDemo, MIN_CELL);
    assert.deepEqual(a.kinds, [{ kind: "hygiene.noTests", repos: MIN_CELL }]);
    assert.deepEqual(a.aiLevels, [{ level: "none", repos: MIN_CELL + 1 }]);
  });

  test("carries no titles, paths or repo names", () => {
    const leaky = finding(fill(copy.checks.secrets.envTitle, { path: "acme/secret-repo/.env" }));
    const a = aggregate(
      Array.from({ length: 5 }, () => summarize([leaky], "none", false)),
      0,
    );
    assert.doesNotMatch(JSON.stringify(a), /acme|secret-repo|\/\.env/);
  });
});

test("repo URLs come out of any CSV cell, deduplicated", () => {
  const csv =
    "name,repo\nA,https://github.com/a/b\nB,https://github.com/A/B.git\nC,https://example.com/x";
  assert.deepEqual(repoUrlsFromCsv(csv), ["https://github.com/a/b"]);
});
