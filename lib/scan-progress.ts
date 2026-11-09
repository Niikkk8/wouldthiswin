// Live scan progress: real events from the server, streamed into act 1 while the scan runs.
// Shared by the server (which emits them) and the client (which renders them).

import { copy, fill } from "./copy";

export type ScanProgress =
  /** GitHub answered: this many files in the repo. */
  | { type: "repo"; files: number }
  /** This commit was scanned in the last 24 hours. */
  | { type: "cached" }
  /** Call A is done: the claims the README makes. */
  | { type: "claims"; claims: string[] }
  /** A candidate file is being fetched. */
  | { type: "reading"; path: string }
  /** A candidate file came back: read, or skipped (binary, minified, missing). */
  | { type: "read"; path: string; ok: boolean }
  /** Call B started: the claims are being checked against what was read. */
  | { type: "checking"; claims: number }
  /** A re-review: last round's fixes are being checked against this many new commits. */
  | { type: "fixes"; commits: number };

export type Emit = (p: ScanProgress) => void;

export const noEmit: Emit = () => {};

/** The status line for an event. */
export function progressLine(p: ScanProgress): string {
  const s = copy.acts.scan.progress;
  switch (p.type) {
    case "repo":
      return fill(s.repo, { n: p.files, s: p.files === 1 ? "" : "s" });
    case "cached":
      return s.cached;
    case "claims":
      return p.claims.length ? fill(s.claims, { n: p.claims.length, s: p.claims.length === 1 ? "" : "s" }) : s.noClaims;
    case "reading":
      return fill(s.reading, { path: p.path });
    case "read":
      return p.ok ? fill(s.reading, { path: p.path }) : fill(s.skipped, { path: p.path });
    case "checking":
      return s.checking;
    case "fixes":
      return fill(s.fixes, { n: p.commits, s: p.commits === 1 ? "" : "s" });
  }
}
