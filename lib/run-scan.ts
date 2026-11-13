// Runs a session's scan once: from the 24h cache when this commit was scanned recently,
// otherwise GitHub plus the model calls. A re-review also checks last round's fixes against
// the diff since, and is never cached: its questions follow up on that round. Server only.

import type { ErrorKey } from "./api";
import { overBudget } from "./budget";
import { fetchCompare, fetchRepoData, fetchSources, GitHubError, parseRepoUrl, type RawRepoData } from "./github";
import { recheckFixes, type Iteration } from "./recheck";
import { snapshotOf } from "./rejudge";
import { mergeUsage, newUsage, type Usage } from "./model";
import { ScanError, demoSignal, scanRepo } from "./scan";
import { judgeContextFor } from "./events";
import { cacheKey, scanWithCache } from "./scan-cache";
import { noEmit, type Emit } from "./scan-progress";
import { applyScan, type Scan, type SessionState } from "./session";
import { errorText, log } from "./log";
import {
  addStepTiming,
  addUsage,
  claimScan,
  deleteSession,
  getCachedScan,
  loadOwnReview,
  loadSession,
  loadSubmission,
  mutate,
  putCachedScan,
  releaseScan,
} from "./session-store";

/** A scan that ends before any model call: nothing was spent on it. */
class ScanStop extends Error {
  constructor(public key: ErrorKey) {
    super(key);
  }
}

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

  let usage: Usage = newUsage();
  try {
    const previous = previousId ? await loadOwnReview(previousId, owner) : null;
    const ref = parseRepoUrl(repoUrl);
    if (!ref) return await fail(id, "invalidUrl", usage);
    // A re-review is never cached: its questions follow up on the round before. Nor is an
    // event's scan: the event's note shapes its questions.
    const eventContext = judgeContextFor(session.eventSlug);
    // Claims from a Devpost page or pasted text aren't in the repo, so neither is the cache key.
    const submission = await loadSubmission(id);
    const cacheable = !previous && !eventContext && !submission.devpostUrl && !submission.text;
    const key = cacheable ? cacheKey(ref.owner, ref.repo, latestSha) : null;
    const result = await scanWithCache<Usage>({
      key,
      get: async (k) => {
        const hit = await getCachedScan(k);
        if (hit) emit({ type: "cached" });
        return hit;
      },
      put: putCachedScan,
      refetch: (paths) =>
        fetchSources(ref, latestSha, paths, (path, phase, ok) =>
          emit(phase === "start" ? { type: "reading", path } : { type: "read", path, ok }),
        ),
      fresh: async () => {
        // Retries after failed scans have already spent this session's share: stop paying.
        if (overBudget(spent)) {
          log.error("scan.over_budget", { id, repo: repoUrl, ...spent });
          throw new ScanStop("judgeFailed");
        }
        const fetchStarted = Date.now();
        const raw = await fetchRepoData(repoUrl);
        await addStepTiming(id, "scan.github", Date.now() - fetchStarted);
        emit({ type: "repo", files: raw.headFilePaths.length });
        if (!raw.readmeFull.trim()) throw new ScanStop("emptyReadme");
        const scanStarted = Date.now();
        const [fresh, fixes] = await Promise.all([
          scanRepo(raw, { emit, demoUrl, previous: previous ? { fixes: previous.fixes } : null, eventContext, submission }),
          previous ? checkFixes(raw, previous, emit) : Promise.resolve(null),
        ]);
        await addStepTiming(id, "scan.total", Date.now() - scanStarted);
        if (!fixes || !previous) return { ...fresh, key: cacheable ? cacheKey(ref.owner, ref.repo, raw.latestSha) : null };
        const iteration = { ...fixes.iteration, previous: snapshotOf(previous.loaded.session) };
        return {
          scan: { ...fresh.scan, signals: { ...fresh.scan.signals, iteration } },
          usage: mergeUsage(fresh.usage, fixes.usage),
          key: null,
        };
      },
    });
    let scan: Scan = result.scan;
    const cached = result.source === "cache";
    if (result.usage) usage = result.usage;
    if (cached) {
      // The cache holds the repo's own demo link; a team's link is checked fresh.
      const demo = demoUrl ? await demoSignal(demoUrl, true) : (scan.autoDemo ?? scan.signals.demo);
      scan = { ...scan, signals: { ...scan.signals, demo } };
    }

    const r = await mutate(id, owner, (s) => applyScan(s, scan));
    await addUsage(id, usage);
    log.info("scan.done", {
      id,
      repo: repoUrl,
      cached,
      claims: scan.claims.length,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    });
    if (r.ok) return { kind: "done", session: r.session };
    return r.session ? { kind: "stale", session: r.session } : { kind: "notFound" };
  } catch (err) {
    if (err instanceof ScanStop) {
      if (err.key === "judgeFailed") {
        await releaseScan(id);
        return { kind: "failed", error: err.key };
      }
      return await fail(id, err.key, usage);
    }
    if (err instanceof ScanError) usage = err.usage;
    const swamped = err instanceof ScanError && err.swamped;
    const key: ErrorKey = err instanceof GitHubError ? err.code : swamped ? "swamped" : "judgeFailed";
    log.error("scan.failed", {
      id,
      repo: repoUrl,
      error: errorText(err),
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    });
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
    round: previous.loaded.session.signals?.iteration?.round ?? (previous.loaded.session.signals?.iteration ? 2 : 1),
    fixes: previous.fixes,
    claims: previous.loaded.session.claims ?? [],
  };
  try {
    const diff = await fetchCompare(raw.ref, previous.loaded.latestSha, raw.latestSha);
    emit({ type: "fixes", commits: diff.commits.length });
    return await recheckFixes(diff, review);
  } catch (err) {
    log.error("recheck.compare_failed", { repo: raw.ref.url, error: String(err) });
    return recheckFixes({ commits: [], files: [], linear: false }, review, () => Promise.reject(new Error("no diff")));
  }
}

/**
 * A scan that spent no tokens deletes its session, so it doesn't count toward the limits.
 * One that spent tokens keeps it (it counts) and records the tokens.
 */
async function fail(id: string, error: ErrorKey, usage: Usage): Promise<ScanOutcome> {
  if (usage.calls.length) {
    await addUsage(id, usage);
    await releaseScan(id);
  } else {
    await deleteSession(id);
  }
  return { kind: "failed", error };
}
