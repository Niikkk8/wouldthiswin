import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { DEMO_SCAN } from "./demo/fixture";
import {
  SCAN_VERSION,
  cacheKey,
  fromCached,
  isCachedScan,
  scanWithCache,
  toCached,
  type CacheKey,
  type CachedScan,
} from "./scan-cache";
import type { Source } from "./sources";

const SHA = "a".repeat(40);

/** An in-memory cache and a scan that counts its model calls. */
function harness() {
  const store = new Map<string, CachedScan>();
  const id = (k: CacheKey) => `${k.owner}/${k.repo}@${k.sha}#${k.version}`;
  let modelCalls = 0;
  const fetched: string[][] = [];
  return {
    store,
    calls: () => modelCalls,
    fetched,
    deps: (key: CacheKey | null) => ({
      key,
      get: async (k: CacheKey) => store.get(id(k)) ?? null,
      put: async (k: CacheKey, s: CachedScan) => void store.set(id(k), s),
      refetch: async (paths: string[]): Promise<Source[]> => {
        fetched.push(paths);
        return DEMO_SCAN.sources.filter((s) => paths.includes(s.path));
      },
      fresh: async () => {
        modelCalls += 2;
        return { scan: DEMO_SCAN, usage: { calls: 2 } };
      },
    }),
  };
}

describe("cache key", () => {
  test("owner, repo, full SHA and the scan version", () => {
    assert.deepEqual(cacheKey("Team", "Repo", SHA), {
      owner: "team",
      repo: "repo",
      sha: SHA,
      version: SCAN_VERSION,
    });
  });

  test("no key without a full commit SHA", () => {
    assert.equal(cacheKey("team", "repo", "main"), null);
    assert.equal(cacheKey("team", "repo", "abc123"), null);
  });
});

describe("what is cached", () => {
  test("findings and file paths, never file contents", () => {
    const cached = toCached(DEMO_SCAN);
    assert.ok(!("sources" in cached));
    assert.deepEqual(
      cached.sourcePaths,
      DEMO_SCAN.sources.map((s) => s.path),
    );
    assert.ok(!JSON.stringify(cached).includes(DEMO_SCAN.sources[0].text));
  });

  test("a hit puts the refetched files back in order, skipping any that are gone", () => {
    const cached = toCached(DEMO_SCAN);
    const [first, ...rest] = DEMO_SCAN.sources;
    const back = fromCached(cached, [...rest].reverse());
    assert.deepEqual(back.sources, rest);
    assert.ok(!back.sources.includes(first));
    assert.deepEqual(back.claims, DEMO_SCAN.claims);
  });

  test("rows in an older shape are not trusted", () => {
    assert.equal(isCachedScan({ claims: [], questions: [], signals: {} }), false);
    assert.equal(isCachedScan(toCached(DEMO_SCAN)), true);
  });
});

describe("scan with cache", () => {
  test("a second session on an unchanged repo makes zero scan-phase model calls", async () => {
    const h = harness();
    const key = cacheKey("team", "repo", SHA);
    const first = await scanWithCache(h.deps(key));
    assert.equal(first.source, "fresh");
    assert.equal(h.calls(), 2);

    const second = await scanWithCache(h.deps(key));
    assert.equal(second.source, "cache");
    assert.equal(second.usage, null);
    assert.equal(h.calls(), 2);
    assert.deepEqual(second.scan.claims, first.scan.claims);
    assert.deepEqual(h.fetched, [DEMO_SCAN.sources.map((s) => s.path)]);
  });

  test("a new push is a new key, so a fresh scan", async () => {
    const h = harness();
    await scanWithCache(h.deps(cacheKey("team", "repo", SHA)));
    const pushed = await scanWithCache(h.deps(cacheKey("team", "repo", "b".repeat(40))));
    assert.equal(pushed.source, "fresh");
    assert.equal(h.calls(), 4);
  });

  test("a new scan version misses the old findings", async () => {
    const h = harness();
    await scanWithCache(h.deps(cacheKey("team", "repo", SHA, 1)));
    const bumped = await scanWithCache(h.deps(cacheKey("team", "repo", SHA, 2)));
    assert.equal(bumped.source, "fresh");
  });

  test("findings are stored under the commit the scan actually read", async () => {
    const h = harness();
    const newer = cacheKey("team", "repo", "c".repeat(40))!;
    await scanWithCache({
      ...h.deps(cacheKey("team", "repo", SHA)),
      fresh: async () => ({ scan: DEMO_SCAN, usage: 0, key: newer }),
    });
    assert.equal(h.store.size, 1);
    assert.equal((await scanWithCache(h.deps(newer))).source, "cache");
  });

  test("a scan that asks not to be cached isn't", async () => {
    const h = harness();
    await scanWithCache({
      ...h.deps(cacheKey("team", "repo", SHA)),
      fresh: async () => ({ scan: DEMO_SCAN, usage: 0, key: null }),
    });
    assert.equal(h.store.size, 0);
  });

  test("without a key nothing is read or written", async () => {
    const h = harness();
    await scanWithCache(h.deps(null));
    await scanWithCache(h.deps(null));
    assert.equal(h.store.size, 0);
    assert.equal(h.calls(), 4);
  });
});
