// Matching model-written text against what was really there: paths into the repo, and quotes
// into files or diffs. Models re-indent and collapse spaces when they copy a line, so runs of
// whitespace match each other; every other character must match.

/** Cleans a model-written path. Null for anything that can't be a repo path. */
export function normalizePath(p: string | null): string | null {
  if (!p) return null;
  let s = p.trim().replace(/^[`'"]+|[`'"]+$/g, "");
  s = s.replace(/^\.\//, "").replace(/^\/+/, "");
  if (!s || s.length > 200 || s.split("/").includes("..") || /[\0\r\n]/.test(s)) return null;
  return s;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** True if `quote` appears in `text`, whitespace-insensitively. */
export function quotedIn(text: string, quote: string): boolean {
  const q = squash(quote);
  return q.length > 0 && squash(text).includes(q);
}

/** The 1-based line a one-line quote sits on, or null. */
export function lineOf(text: string, quote: string): number | null {
  const q = squash(quote);
  if (!q) return null;
  const i = text.split(/\r?\n/).findIndex((l) => squash(l).includes(q));
  return i >= 0 ? i + 1 : null;
}
