// What every deterministic check reads: a snapshot of the repo at one commit. Collected once
// per scan (lib/checks/collect.ts); the checks themselves are pure functions over it.

export type RepoSnapshot = {
  /** "owner/repo". */
  repo: string;
  /** Every file path at the commit. */
  tree: readonly string[];
  /** Blob sizes in bytes, where GitHub reported them. */
  sizes: Readonly<Record<string, number>>;
  /** Text of the files fetched for checking. Never stored or sent to a model as is. */
  files: ReadonlyMap<string, string>;
  readme: string;
  /** Commits that touched each env file path, newest first (from GitHub's commits API). */
  envHistory: Readonly<Record<string, readonly string[]>>;
};

export const snapshot = (over: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  repo: "team/app",
  tree: [],
  sizes: {},
  files: new Map(),
  readme: "",
  envHistory: {},
  ...over,
});
