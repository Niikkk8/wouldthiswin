// Runs a session's scan once: from the 24h cache when this commit was scanned recently,
// otherwise GitHub plus one model call. Server only.

import type { ErrorKey } from "./api";
import { fetchRepoData, GitHubError } from "./github";
import { ScanError, scanRepo, type Usage } from "./scan";
import { applyScan, type Scan, type SessionState } from "./session";
import {
  addUsage,
  claimScan,
  deleteSession,
  getCachedScan,
  loadSession,
  mutate,
  putCachedScan,
  releaseScan,
} from "./session-store";

export type ScanOutcome =
  | { kind: "done"; session: SessionState }
  | { kind: "pending"; session: SessionState }
  | { kind: "stale"; session: SessionState }
  | { kind: "notFound" }
  | { kind: "failed"; error: ErrorKey };

export async function runSessionScan(id: string, owner: string | null): Promise<ScanOutcome> {
  const loaded = await loadSession(id, owner);
  if (!loaded) return { kind: "notFound" };
  const { session, repoUrl, latestSha } = loaded;
  if (session.claims !== null) return { kind: "done", session };
  if (session.act !== "scan") return { kind: "stale", session };
  // Another request (a second tab, a refresh) is already scanning: the client waits and asks again.
  if (!(await claimScan(id))) return { kind: "pending", session };

  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  try {
    let scan: Scan | null = await getCachedScan(repoUrl, latestSha);
    const cached = scan !== null;
    if (!scan) {
      const raw = await fetchRepoData(repoUrl);
      if (!raw.readmeFull.trim()) return await fail(id, "emptyReadme", usage);
      const result = await scanRepo(raw);
      scan = result.scan;
      usage = result.usage;
      await putCachedScan(repoUrl, raw.latestSha, scan);
    }

    const r = await mutate(id, owner, (s) => applyScan(s, scan));
    await addUsage(id, usage);
    console.log(
      JSON.stringify({
        event: "scan.done",
        id,
        repo: repoUrl,
        cached,
        claims: scan.claims.length,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
      }),
    );
    if (r.ok) return { kind: "done", session: r.session };
    return r.session ? { kind: "stale", session: r.session } : { kind: "notFound" };
  } catch (err) {
    if (err instanceof ScanError) usage = err.usage;
    const key: ErrorKey = err instanceof GitHubError ? err.code : "judgeFailed";
    console.error(
      JSON.stringify({
        event: "scan.failed",
        id,
        repo: repoUrl,
        error: err instanceof Error ? err.message : String(err),
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
      }),
    );
    return await fail(id, key, usage);
  }
}

/**
 * A scan that spent no tokens deletes its session, so it doesn't count toward the limits.
 * One that spent tokens keeps it (it counts) and records the tokens.
 */
async function fail(id: string, error: ErrorKey, usage: Usage): Promise<ScanOutcome> {
  if (usage.inputTokens || usage.outputTokens) {
    await addUsage(id, usage);
    await releaseScan(id);
  } else {
    await deleteSession(id);
  }
  return { kind: "failed", error };
}
