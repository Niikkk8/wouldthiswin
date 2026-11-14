// Check 6: repo hygiene. Tests, CI, a license, no files over 1 MB, no committed dependencies
// or build output. Small things, but judges who open the repo notice them.

import { copy, fill } from "../copy";
import type { Finding } from "../findings";
import type { RepoSnapshot } from "./types";

const TESTS =
  /(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.(go|py)$/i;
const CI =
  /^(\.github\/workflows\/[^/]+\.ya?ml|\.gitlab-ci\.yml|\.circleci\/config\.yml|azure-pipelines\.yml|\.travis\.yml|bitbucket-pipelines\.yml)$/;
const LICENSE = /^(LICEN[CS]E|COPYING)(\.(md|txt))?$/i;
const COMMITTED = /(^|\/)(node_modules|\.next|dist|build|out|__pycache__|\.venv|venv)\//;
const BIG = 1024 * 1024;

const H = copy.checks.hygiene;

export function hygiene(s: RepoSnapshot): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, "id" | "check" | "visibility">) =>
    out.push({ ...f, id: `hygiene-${out.length + 1}`, check: "hygiene", visibility: "public" });

  if (!s.tree.some((p) => TESTS.test(p))) {
    add({
      outcome: "warn",
      severity: "minor",
      title: H.noTests,
      detail: H.noTestsDetail,
      evidence: [{ kind: "check", detail: H.noTestsCheck }],
      fix: H.noTestsFix,
      effort: "2h",
    });
  }
  if (!s.tree.some((p) => CI.test(p))) {
    add({
      outcome: "warn",
      severity: "minor",
      title: H.noCi,
      detail: H.noCiDetail,
      evidence: [{ kind: "check", detail: H.noCiCheck }],
      fix: H.noCiFix,
      effort: "30m",
    });
  }
  if (!s.tree.some((p) => LICENSE.test(p))) {
    add({
      outcome: "warn",
      severity: "minor",
      title: H.noLicense,
      detail: H.noLicenseDetail,
      evidence: [{ kind: "check", detail: H.noLicenseCheck }],
      fix: H.noLicenseFix,
      effort: "5m",
    });
  }
  const big = Object.entries(s.sizes)
    .filter(([path, size]) => size > BIG && !COMMITTED.test(path))
    .sort(([, a], [, b]) => b - a);
  if (big.length) {
    add({
      outcome: "warn",
      severity: "minor",
      title: fill(H.bigFiles, { n: big.length }),
      detail: big
        .slice(0, 3)
        .map(([p, n]) => `${p} (${(n / BIG).toFixed(1)} MB)`)
        .join(", "),
      evidence: big.slice(0, 3).map(([path]) => ({ kind: "file" as const, path })),
      fix: H.bigFilesFix,
      effort: "30m",
    });
  }
  const committed = [
    ...new Set(
      s.tree.filter((p) => COMMITTED.test(p)).map((p) => p.match(COMMITTED)![0].replace(/^\//, "")),
    ),
  ];
  if (committed.length) {
    add({
      outcome: "fail",
      severity: "major",
      title: H.committed,
      detail: fill(H.committedDetail, { dirs: committed.slice(0, 3).join(", ") }),
      evidence: committed
        .slice(0, 3)
        .map((dir) => ({ kind: "file" as const, path: dir.replace(/\/$/, "") })),
      fix: H.committedFix,
      effort: "5m",
    });
  }
  return out;
}
