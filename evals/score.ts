// Scores the deterministic checks against the fixtures: per check, precision and recall over
// "did this check report a problem on this fixture". Pure, so the eval is also a test.

import { aiDepth, aiDepthFindings, usesPretrained } from "../lib/checks/ai-depth";
import { runChecks } from "../lib/checks";
import type { RepoSnapshot } from "../lib/checks/types";
import type { Finding } from "../lib/findings";
import type { Fixture } from "./fixtures/types";

export function snapshotOf(f: Fixture): RepoSnapshot {
  return { repo: `eval/${f.name}`, tree: Object.keys(f.files), sizes: f.sizes ?? {}, files: new Map(Object.entries(f.files)), readme: f.readme, envHistory: {} };
}

export function findingsFor(f: Fixture): Finding[] {
  const snap = snapshotOf(f);
  return [...runChecks(snap), ...aiDepthFindings(aiDepth(snap), f.claims, usesPretrained(snap))];
}

/** The checks that reported a problem (anything but a pass). */
export const fired = (fs: readonly Finding[]) => new Set(fs.filter((x) => x.outcome !== "pass").map((x) => x.check));

export type CheckScore = { check: string; tp: number; fp: number; fn: number; precision: number | null; recall: number | null };

export function scoreChecks(fixtures: readonly Fixture[]): CheckScore[] {
  const results = fixtures.map((f) => ({ expected: new Set(f.expected), got: fired(findingsFor(f)) }));
  const checks = [...new Set(results.flatMap((r) => [...r.expected, ...r.got]))].sort();
  return checks.map((check) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const r of results) {
      const e = r.expected.has(check);
      const g = r.got.has(check);
      if (e && g) tp++;
      else if (g) fp++;
      else if (e) fn++;
    }
    return { check, tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
  });
}

/** Two fixtures produce the same findings, id for id and outcome for outcome. */
export function sameFindings(a: Fixture, b: Fixture): boolean {
  const key = (f: Fixture) => findingsFor(f).map((x) => `${x.id}:${x.outcome}:${x.severity}`).join("|");
  return key(a) === key(b);
}
