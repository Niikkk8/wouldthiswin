// Usage: npm run signals -- <githubRepoUrl> [demoUrl]
// Reads GITHUB_TOKEN from .env / .env.local if present.

import { checkDemo } from "../lib/demo-check";
import { fetchRepoData, GitHubError } from "../lib/github";
import { computeSignals } from "../lib/signals";

async function main() {
  const [repoUrl, demoUrl] = process.argv.slice(2);
  if (!repoUrl) {
    console.error("Usage: npm run signals -- <githubRepoUrl> [demoUrl]");
    process.exit(1);
  }
  if (!process.env.GITHUB_TOKEN) {
    console.warn("! GITHUB_TOKEN not set: using unauthenticated GitHub API (60 req/hr).\n");
  }

  const t0 = Date.now();
  const [raw, demo] = await Promise.all([
    fetchRepoData(repoUrl),
    demoUrl ? checkDemo(demoUrl) : Promise.resolve(null),
  ]);
  const signals = computeSignals(raw, demo);

  console.log("== fetched ==");
  console.log(
    JSON.stringify(
      {
        repo: raw.ref.url,
        meta: raw.meta,
        latestSha: raw.latestSha,
        readmeChars: { full: raw.readmeFull.length, sentToModel: raw.readme.length },
        treeEntries: raw.tree.length,
        treeEntriesTruncated: raw.treeEntriesTruncated,
        headFiles: raw.headFilePaths.length,
        rootCommit: {
          sha: raw.rootCommit.sha,
          date: raw.rootCommit.date,
          files: raw.rootCommit.filePaths.length,
          treeTruncated: raw.rootCommit.treeTruncated,
        },
        commitsFetched: raw.commits.length,
        recentCommits: raw.commits.slice(0, 5).map((c) => `${c.date}  ${c.message.split("\n")[0]}`),
        hasPackageJson: raw.packageJson !== null,
        hasRequirementsTxt: raw.requirementsTxt !== null,
      },
      null,
      2,
    ),
  );
  console.log("\n== signals ==");
  console.log(JSON.stringify(signals, null, 2));
  console.log(`\n(${Date.now() - t0} ms)`);
}

main().catch((err) => {
  if (err instanceof GitHubError)
    console.error(`GitHubError: ${err.code} ${err.message !== err.code ? err.message : ""}`);
  else console.error(err);
  process.exitCode = 1;
});
