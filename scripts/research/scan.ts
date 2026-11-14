// npm run research -- repos.csv [--out content/research/state-of-hackathon-repos-2026.json] [--limit 500]
// Runs the deterministic checks (F12), the demo check (F13) and the AI depth check (F15) over
// public repos listed in a CSV, and writes aggregate counts only. Nothing per repo is written
// or printed: no names, no findings, no paths, no secrets. Needs GITHUB_TOKEN; waits out the
// GitHub rate limit instead of failing.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Octokit } from "@octokit/rest";
import { aiDepth } from "../../lib/checks/ai-depth";
import { collectSnapshot } from "../../lib/checks/collect";
import { checkDemos, demoCandidates } from "../../lib/checks/demo";
import { runChecks } from "../../lib/checks";
import { fetchPage } from "../../lib/demo-check";
import { commitsTouching, fetchRepoData, readRawAt } from "../../lib/github";
import { aggregate, repoUrlsFromCsv, summarize, type RepoSummary } from "../../lib/research";

const DEFAULT_OUT = "content/research/state-of-hackathon-repos-2026.json";
/** A repo costs about 60 core calls (metadata, tree, up to 40 files, env history). */
const CALLS_PER_REPO = 80;
const CONCURRENCY = 3;
const RETRIES = 3;

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const say = (line: string) => process.stderr.write(`${line}\n`);

const token = process.env.GITHUB_TOKEN;
if (!token) {
  say("GITHUB_TOKEN is required: unauthenticated GitHub allows 60 calls an hour.");
  process.exit(1);
}
const gh = new Octokit({ auth: token, userAgent: "wouldthiswin-research" });

/** Waits until the core rate limit has room for one more repo. One wait at a time. */
let waiting: Promise<void> | null = null;
async function budget(): Promise<void> {
  while (waiting) await waiting;
  const { data } = await gh.rateLimit.get();
  const core = data.resources.core;
  if (core.remaining >= CALLS_PER_REPO) return;
  const ms = Math.max(0, core.reset * 1000 - Date.now()) + 5000;
  say(`rate limit: ${core.remaining} calls left, waiting ${Math.ceil(ms / 60000)} min`);
  waiting = sleep(ms).then(() => {
    waiting = null;
  });
  await waiting;
}

async function scanOne(url: string): Promise<RepoSummary> {
  for (let attempt = 0; ; attempt++) {
    await budget();
    try {
      const raw = await fetchRepoData(url, token);
      const snap = await collectSnapshot(
        {
          repo: `${raw.ref.owner}/${raw.ref.repo}`,
          tree: raw.headFilePaths,
          sizes: raw.headFileSizes,
          readme: raw.readmeFull,
        },
        {
          read: (p) => readRawAt(raw.ref, raw.latestSha, p, token),
          commits: (p) => commitsTouching(raw.ref, p, token),
        },
      );
      const demos = demoCandidates({
        readme: raw.readmeFull,
        homepage: raw.meta.homepage,
        devpostLinks: [],
      });
      const demo = await checkDemos(demos, (u) => fetchPage(u), raw.ref.repo);
      return summarize([...runChecks(snap), ...demo], aiDepth(snap).level, demos.length > 0);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "githubDown" || attempt >= RETRIES) throw err;
      await sleep(30_000 * 2 ** attempt);
    }
  }
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath || csvPath.startsWith("--")) {
    say("usage: npm run research -- repos.csv [--out path.json] [--limit n]");
    process.exit(1);
  }
  const limit = Number(arg("--limit") ?? 500);
  const out = arg("--out") ?? DEFAULT_OUT;
  const urls = repoUrlsFromCsv(await readFile(csvPath, "utf8")).slice(0, limit);
  say(`${urls.length} repos`);

  const results: RepoSummary[] = [];
  let failed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < urls.length) {
        const i = next++;
        try {
          results.push(await scanOne(urls[i]));
        } catch (err) {
          failed++;
          // The error code only: a message could name the repo.
          say(`repo ${i + 1}: failed (${(err as { code?: string }).code ?? "error"})`);
        }
        if ((i + 1) % 25 === 0) say(`${i + 1} of ${urls.length}`);
      }
    }),
  );

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(aggregate(results, failed), null, 2)}\n`);
  say(`wrote ${out}: ${results.length} scanned, ${failed} failed`);
}

main().catch((err) => {
  say(`research scan failed: ${(err as { code?: string }).code ?? "error"}`);
  process.exit(1);
});
