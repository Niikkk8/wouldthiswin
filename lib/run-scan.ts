// Runs a session's scan once: from the 24h cache when this commit was scanned recently,
// otherwise GitHub plus the model calls. A re-review also checks last round's fixes against
// the diff since, and is never cached: its questions follow up on that round. Server only.

import type { ErrorKey } from "./api";
import { overBudget } from "./budget";
import { fetchCompare, fetchRepoData, GitHubError, type RawRepoData } from "./github";
import { recheckFixes, type Iteration } from "./recheck";
import { ScanError, demoSignal, scanRepo, type Usage } from "./scan";
import { noEmit, type Emit } from "./scan-progress";
import { applyScan, type Scan, type SessionState } from "./session";
import {
  addUsage,
  claimScan,
  deleteSession,
  getCachedScan,
  loadOwnReview,
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

export async function runSessionScan(id: string, owner: string | null, emit: Emit = noEmit): Promise<ScanOutcome> {
  const loaded = await loadSession(id, owner);
  if (!loaded) return { kind: "notFound" };
  const { session, repoUrl, latestSha, demoUrl, spent, previousId } = loaded;
  if (session.claims !== null) return { kind: "done", session };
  if (session.act !== "scan") return { kind: "stale", session };
  // Another request (a second tab, a refresh) is already scanning: the client waits and asks again.
  if (!(await claimScan(id))) return { kind: "pending", session };

  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  try {
    const previous = previousId ? await loadOwnReview(previousId, owner) : null;
    let scan: Scan | null = previous ? null : await getCachedScan(repoUrl, latestSha);
    const cached = scan !== null;
    if (scan) {
      emit({ type: "cached" });
      // The cache holds the repo's own demo link; a team's link is checked fresh.
      const demo = demoUrl ? await demoSignal(demoUrl, true) : (scan.autoDemo ?? scan.signals.demo);
      scan = { ...scan, signals: { ...scan.signals, demo } };
    } else {
      // Retries after failed scans have already spent this session's share: stop paying.
      if (overBudget(spent)) {
        console.error(JSON.stringify({ event: "scan.over_budget", id, repo: repoUrl, ...spent }));
        await releaseScan(id);
        return { kind: "failed", error: "judgeFailed" };
      }
      const raw = await fetchRepoData(repoUrl);
      emit({ type: "repo", files: raw.headFilePaths.length });
      if (!raw.readmeFull.trim()) return await fail(id, "emptyReadme", usage);
      const [result, fixes] = await Promise.all([
        scanRepo(raw, { emit, demoUrl, previous: previous ? { fixes: previous.fixes } : null }),
        previous ? checkFixes(raw, previous, emit) : Promise.resolve(null),
      ]);
      scan = result.scan;
      usage = result.usage;
      if (fixes) {
        usage = { inputTokens: usage.inputTokens + fixes.usage.inputTokens, outputTokens: usage.outputTokens + fixes.usage.outputTokens };
        scan = { ...scan, signals: { ...scan.signals, iteration: fixes.iteration } };
      } else {
        await putCachedScan(repoUrl, raw.latestSha, scan);
      }
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
    const swamped = err instanceof ScanError && err.swamped;
    const key: ErrorKey = err instanceof GitHubError ? err.code : swamped ? "swamped" : "judgeFailed";
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
    // Anthropic being busy isn't the visitor's fault: the session never counts, even if the
    // first call went through before the second was turned away.
    if (swamped) {
      await deleteSession(id);
      return { kind: "failed", error: key };
    }
    return await fail(id, key, usage);
  }
}

/**
 * Last round's fixes against everything pushed since that review's commit. If GitHub can't
 * produce the diff, every fix stays open with a note saying so: no credit nobody checked.
 */
async function checkFixes(
  raw: RawRepoData,
  previous: NonNullable<Awaited<ReturnType<typeof loadOwnReview>>>,
  emit: Emit,
): Promise<{ iteration: Iteration; usage: Usage }> {
  const review = {
    id: previous.loaded.session.id,
    odds: previous.odds,
    fixes: previous.fixes,
    claims: previous.loaded.session.claims ?? [],
  };
  try {
    const diff = await fetchCompare(raw.ref, previous.loaded.latestSha, raw.latestSha);
    emit({ type: "fixes", commits: diff.commits.length });
    return await recheckFixes(diff, review);
  } catch (err) {
    console.error(JSON.stringify({ event: "recheck.compare_failed", repo: raw.ref.url, error: String(err) }));
    return recheckFixes({ commits: [], files: [], linear: false }, review, () => Promise.reject(new Error("no diff")));
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
