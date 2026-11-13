// Findings: everything the panel found, each with the evidence it rests on. No citation, no
// finding: every one names a file and line at the scanned commit, a commit, a URL or the
// deterministic check that produced it. The rubric cites findings by id, the fix list is
// built from them, and the public review only ever shows the public ones.

import { copy, fill } from "./copy";
import type { Claim, ScanSignals, SessionState } from "./session";

export type Severity = "blocker" | "major" | "minor";
/** How long the fix takes, roughly. */
export type Effort = "5m" | "30m" | "2h";
/** pass: holds up. warn: a judge may ask. fail: a judge will mark it down. */
export type Outcome = "pass" | "warn" | "fail";

export type Evidence =
  | { kind: "file"; path: string; startLine?: number; endLine?: number }
  | { kind: "url"; url: string }
  | { kind: "commit"; sha: string }
  | { kind: "check"; detail: string };

export type Finding = {
  /** Stable within a session: "claim-2", "demo", "commits". */
  id: string;
  /** What produced it: "claim", "demo", "history", and the deterministic checks. */
  check: string;
  outcome: Outcome;
  /** Null for passes. */
  severity: Severity | null;
  title: string;
  detail: string;
  evidence: Evidence[];
  /** One line saying what to do. Null when there's nothing to fix. */
  fix: string | null;
  effort: Effort | null;
  /** Private findings (secrets, timeline, team) are for the session owner only. */
  visibility: "public" | "private";
};

const F = copy.findings;

function claimSeverity(c: Claim): Severity {
  if (c.status === "unbacked") return c.weight === "core" ? "blocker" : "major";
  if (c.status === "mocked") return c.weight === "core" ? "major" : "minor";
  return "minor";
}

function claimFinding(c: Claim, i: number): Finding {
  const id = `claim-${i + 1}`;
  const fileEvidence: Evidence[] = c.file
    ? [{ kind: "file", path: c.file, ...(c.line ? { startLine: c.line, endLine: c.line } : {}) }]
    : [];
  const searched: Evidence[] = c.searched.map((path) => ({ kind: "file", path }));
  const base = { id, check: "claim", title: c.claim, detail: c.evidence, visibility: "public" as const };
  switch (c.status) {
    case "backed":
      return { ...base, outcome: "pass", severity: null, evidence: fileEvidence, fix: null, effort: null };
    case "mocked":
      return {
        ...base,
        outcome: "fail",
        severity: claimSeverity(c),
        evidence: fileEvidence,
        fix: fill(F.fix.mocked, { path: c.file ?? "" }),
        effort: "2h",
      };
    case "unbacked":
      return {
        ...base,
        outcome: "fail",
        severity: claimSeverity(c),
        evidence: searched.length ? searched : [{ kind: "check", detail: c.evidence }],
        fix: fill(F.fix.unbacked, { missing: c.missing ?? c.claim, claim: c.claim }),
        effort: c.weight === "core" ? "2h" : "30m",
      };
    case "unclear":
      return {
        ...base,
        outcome: "warn",
        severity: "minor",
        evidence: fileEvidence.length ? fileEvidence : [{ kind: "check", detail: c.evidence }],
        fix: F.fix.unclear,
        effort: "5m",
      };
  }
}

function demoFinding(demo: ScanSignals["demo"]): Finding {
  const url: Evidence[] = demo.url ? [{ kind: "url", url: demo.url }] : [{ kind: "check", detail: F.demoChecked }];
  const base = { id: "demo", check: "demo", evidence: url, visibility: "public" as const };
  switch (demo.status) {
    case "loads":
      return { ...base, outcome: "pass", severity: null, title: copy.review.checks.demoLoads, detail: F.demoLoads, fix: null, effort: null };
    case "video":
      return { ...base, outcome: "pass", severity: null, title: copy.review.checks.demoVideo, detail: F.demoVideo, fix: null, effort: null };
    case "dead":
      return { ...base, outcome: "fail", severity: "blocker", title: copy.review.checks.demoDead, detail: F.demoDead, fix: F.fix.demoDead, effort: "30m" };
    case "none":
      return { ...base, outcome: "fail", severity: "major", title: copy.review.checks.demoNone, detail: copy.review.checks.demoNoneDetail, fix: F.fix.demoNone, effort: "2h" };
  }
}

/** Every finding for a scanned session, in a stable order: claims, then the demo, then history. */
export function findingsOf(s: Pick<SessionState, "claims" | "signals">): Finding[] {
  const out = (s.claims ?? []).map(claimFinding);
  if (!s.signals) return out;
  out.push(demoFinding(s.signals.demo));
  if (s.signals.bulkFirstCommit) {
    // Timeline signals are framed as what a judge might ask, and kept to the owner.
    out.push({
      id: "commits",
      check: "history",
      outcome: "warn",
      severity: "minor",
      title: copy.review.checks.bulkCommit,
      detail: F.bulkCommit,
      evidence: s.signals.commit ? [{ kind: "commit", sha: s.signals.commit }] : [{ kind: "check", detail: F.bulkCommitCheck }],
      fix: null,
      effort: null,
      visibility: "private",
    });
  }
  return out;
}

export const publicFindings = (fs: readonly Finding[]) => fs.filter((f) => f.visibility === "public");

/** A link for one piece of evidence, pinned to the scanned commit. Null for a check's own words. */
export function evidenceHref(e: Evidence, repo: string, commit: string | undefined): string | null {
  switch (e.kind) {
    case "url":
      return e.url;
    case "commit":
      return `https://github.com/${repo}/commit/${e.sha}`;
    case "file": {
      const ref = commit ?? "HEAD";
      const lines = e.startLine ? `#L${e.startLine}${e.endLine && e.endLine !== e.startLine ? `-L${e.endLine}` : ""}` : "";
      return `https://github.com/${repo}/blob/${ref}/${e.path.split("/").map(encodeURIComponent).join("/")}${lines}`;
    }
    case "check":
      return null;
  }
}

/** "lib/queue.ts:12", "lib/queue.ts:12-18", or the URL or short SHA. */
export function evidenceLabel(e: Evidence): string {
  switch (e.kind) {
    case "file":
      return e.startLine ? `${e.path}:${e.startLine}${e.endLine && e.endLine !== e.startLine ? `-${e.endLine}` : ""}` : e.path;
    case "url":
      return e.url.replace(/^https?:\/\//, "");
    case "commit":
      return e.sha.slice(0, 7);
    case "check":
      return e.detail;
  }
}
