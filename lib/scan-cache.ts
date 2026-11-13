// The scan cache. A scan is keyed by the repo, its head commit and SCAN_VERSION: the same
// commit judged by the same checks gives the same findings, so a second session on an
// unchanged repo reuses them and makes no scan-phase model calls. A new push is a new SHA,
// so a fresh scan. Only findings are cached, never file contents: on a hit, the files the
// review quotes are fetched again from GitHub at that exact commit.

import type { Scan } from "./session";
import type { Source } from "./sources";

/** Bump whenever the checks, prompts or validation change what a scan finds. */
export const SCAN_VERSION = 7;

export type CacheKey = { owner: string; repo: string; sha: string; version: number };

const SHA_RE = /^[0-9a-f]{40}$/;

export function cacheKey(owner: string, repo: string, sha: string, version = SCAN_VERSION): CacheKey | null {
  if (!owner || !repo || !SHA_RE.test(sha)) return null;
  return { owner: owner.toLowerCase(), repo: repo.toLowerCase(), sha, version };
}

/** A scan without the contents of the files it read: only their paths. */
export type CachedScan = Omit<Scan, "sources"> & { sourcePaths: string[] };

export function toCached(scan: Scan): CachedScan {
  const { sources, ...rest } = scan;
  return { ...rest, sourcePaths: sources.map((s) => s.path) };
}

/** The cached findings with the files fetched again. A file that can't be fetched is simply not there. */
export function fromCached(cached: CachedScan, sources: Source[]): Scan {
  const { sourcePaths, ...rest } = cached;
  const byPath = new Map(sources.map((s) => [s.path, s]));
  return { ...rest, sources: sourcePaths.flatMap((p) => byPath.get(p) ?? []) };
}

/** Rejects rows written by an older shape of the cache. */
export function isCachedScan(v: unknown): v is CachedScan {
  if (!v || typeof v !== "object") return false;
  const c = v as Partial<CachedScan>;
  return Array.isArray(c.claims) && Array.isArray(c.questions) && Array.isArray(c.sourcePaths) && !!c.signals;
}

export type ScanSource = "cache" | "fresh";

/**
 * Cache first, then the real scan. Dependencies are passed in so the rule "a hit makes no
 * model calls" is tested without a database or a model.
 */
export async function scanWithCache<U>(deps: {
  key: CacheKey | null;
  get: (key: CacheKey) => Promise<CachedScan | null>;
  put: (key: CacheKey, scan: CachedScan) => Promise<void>;
  refetch: (paths: string[]) => Promise<Source[]>;
  /**
   * The real scan. It may return the key to store under: GitHub can have moved on to a newer
   * commit since the session started, and the findings belong to the commit actually read.
   * Null means "don't cache this one" (a re-review, whose questions follow up on last round).
   */
  fresh: () => Promise<{ scan: Scan; usage: U; key?: CacheKey | null }>;
}): Promise<{ scan: Scan; usage: U | null; source: ScanSource }> {
  const hit = deps.key ? await deps.get(deps.key) : null;
  if (hit) {
    const sources = hit.sourcePaths.length ? await deps.refetch(hit.sourcePaths) : [];
    return { scan: fromCached(hit, sources), usage: null, source: "cache" };
  }
  const { scan, usage, key } = await deps.fresh();
  const storeAs = key === undefined ? deps.key : key;
  if (storeAs) await deps.put(storeAs, toCached(scan));
  return { scan, usage, source: "fresh" };
}
