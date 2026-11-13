// F16: sponsor and track fit. For each sponsor track an event lists (lib/events presets), is
// the sponsor's tech used for real (imported or called in app code), only installed, or not
// there at all? Tracks the team says it's entering, with no real use, become findings.

import { copy, fill } from "../copy";
import type { SponsorSignature } from "../events/types";
import type { Evidence, Finding } from "../findings";
import { npmDeps, pyDeps } from "../signals";
import type { RepoSnapshot } from "./types";

export type TrackUse = "used" | "installed" | "not_found";
export type TrackReport = { sponsor: string; track: string; use: TrackUse; evidence: Evidence[] };

const APP_CODE = /\.(m?[jt]sx?|py|svelte|vue|go|rb|php|java|kt|swift|rs|dart)$/;
const MANIFEST = /(^|\/)(package\.json|requirements\.txt)$/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every dependency name any manifest in the snapshot declares, lowercased. */
function dependencies(files: ReadonlyMap<string, string>): Map<string, string> {
  const deps = new Map<string, string>();
  for (const [path, text] of files) {
    if (!MANIFEST.test(path)) continue;
    for (const d of path.endsWith("package.json") ? npmDeps(text) : pyDeps(text)) deps.set(d.toLowerCase(), path);
  }
  return deps;
}

export function trackReports(s: Pick<RepoSnapshot, "files">, signatures: readonly SponsorSignature[]): TrackReport[] {
  const deps = dependencies(s.files);
  return signatures.map((sig) => {
    const imports = sig.detect.imports.map((i) => new RegExp(`(from\\s+["']?${esc(i)}|require\\(\\s*["']${esc(i)}|import\\s+${esc(i)}\\b|import\\s+["']${esc(i)})`));
    const hosts = sig.detect.hosts.map((h) => new RegExp(esc(h), "i"));
    const used: Evidence[] = [];
    for (const [path, text] of s.files) {
      if (!APP_CODE.test(path)) continue;
      text.split(/\r?\n/).forEach((line, i) => {
        if (used.length < 3 && (imports.some((re) => re.test(line)) || hosts.some((re) => re.test(line)))) {
          used.push({ kind: "file", path, startLine: i + 1, endLine: i + 1 });
        }
      });
    }
    if (used.length) return { sponsor: sig.sponsor, track: sig.track, use: "used" as const, evidence: used };
    const pkg = sig.detect.packages.map((p) => p.toLowerCase()).find((p) => deps.has(p));
    if (pkg) return { sponsor: sig.sponsor, track: sig.track, use: "installed" as const, evidence: [{ kind: "file" as const, path: deps.get(pkg)! }] };
    return { sponsor: sig.sponsor, track: sig.track, use: "not_found" as const, evidence: [] };
  });
}

const S = copy.checks.sponsors;

/** A report line for every entered track, and a finding when an entered track has no real use. */
export function sponsorFindings(reports: readonly TrackReport[], entered: readonly string[]): Finding[] {
  return reports
    .filter((r) => entered.includes(r.track))
    .map((r, i): Finding => {
      const base = { id: `track-${i + 1}`, check: "sponsors", visibility: "public" as const, detail: fill(S.detail[r.use], { sponsor: r.sponsor }) };
      if (r.use === "used") return { ...base, outcome: "pass", severity: null, title: fill(S.used, { track: r.track }), evidence: r.evidence, fix: null, effort: null };
      return {
        ...base,
        outcome: r.use === "installed" ? "warn" : "fail",
        severity: "major",
        title: fill(r.use === "installed" ? S.installed : S.notFound, { track: r.track }),
        evidence: r.evidence.length ? r.evidence : [{ kind: "check", detail: fill(S.searched, { sponsor: r.sponsor }) }],
        fix: fill(S.fix, { sponsor: r.sponsor }),
        effort: "2h",
      };
    });
}
