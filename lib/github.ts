import { Octokit } from "@octokit/rest";
import { parseRepoUrl, type RepoRef } from "./repo-url";
import { readableText, type Source } from "./sources";

export { parseRepoUrl, type RepoRef };

export const README_MAX_CHARS = 6000;
export const TREE_MAX_DEPTH = 2;
export const TREE_MAX_ENTRIES = 200;
export const COMMITS_LIMIT = 50;
const GITHUB_TIMEOUT_MS = 10_000;

/** Matches keys in copy.errors. Private repos are reported as notFound. */
export type GitHubErrorCode = "invalidUrl" | "notFound" | "emptyRepo" | "githubDown";

export class GitHubError extends Error {
  constructor(
    public code: GitHubErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "GitHubError";
  }
}

export type TreeEntry = { path: string; type: "blob" | "tree" | "commit" };

export type CommitInfo = { sha: string; date: string; message: string; author: string };

export type RawRepoData = {
  ref: RepoRef;
  meta: {
    fullName: string;
    description: string | null;
    homepage: string | null;
    language: string | null;
    topics: string[];
    stars: number;
    forks: number;
    defaultBranch: string;
    createdAt: string;
    pushedAt: string | null;
  };
  /** Full README text (used for length / image detection). */
  readmeFull: string;
  /** README truncated to README_MAX_CHARS (what goes to the model). */
  readme: string;
  /** Top TREE_MAX_DEPTH levels, at most TREE_MAX_ENTRIES entries. */
  tree: TreeEntry[];
  /** True if more top-level entries existed than TREE_MAX_ENTRIES. */
  treeEntriesTruncated: boolean;
  /** Every file path (blob) at HEAD, from the recursive tree. */
  headFilePaths: string[];
  /** GitHub truncated the recursive HEAD tree (100k entries / 7MB). */
  headTreeTruncated: boolean;
  /** Last COMMITS_LIMIT commits, newest first. */
  commits: CommitInfo[];
  /** Total commits on the default branch. */
  commitCount: number;
  latestSha: string;
  rootCommit: CommitInfo & {
    /** Every file path present in the root commit's tree (all were added by it). */
    filePaths: string[];
    /** GitHub truncated the root tree, so filePaths is incomplete. */
    treeTruncated: boolean;
  };
  packageJson: string | null;
  requirementsTxt: string | null;
  /** package.json / requirements.txt files below the root (e.g. backend/requirements.txt). */
  nestedManifests: { path: string; text: string }[];
};

const MANIFEST = /(^|\/)(package\.json|requirements\.txt)$/;
const NESTED_MANIFESTS = 4;

function toGitHubError(err: unknown): GitHubError {
  if (err instanceof GitHubError) return err;
  const e = err as {
    status?: number;
    name?: string;
    response?: { headers?: Record<string, string | undefined> };
  };
  if (e?.status === 404) return new GitHubError("notFound");
  if (e?.status === 409) return new GitHubError("emptyRepo");
  // Rate limits, timeouts, 5xx: all "GitHub isn't answering right now".
  return new GitHubError("githubDown", err instanceof Error ? err.message : String(err));
}

/** Returns null on 404, rethrows anything else. */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }
}

function lastPageFromLink(link: string | undefined): number | null {
  if (!link) return null;
  const m = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return m ? Number(m[1]) : null;
}

type ApiCommit = {
  sha: string;
  author?: { login?: string } | null;
  commit: {
    message: string;
    author: { date?: string; name?: string } | null;
    committer: { date?: string } | null;
    tree: { sha: string };
  };
};

function toCommitInfo(c: ApiCommit): CommitInfo {
  return {
    sha: c.sha,
    // Author date = when the work was written; committer date changes on rebase.
    date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
    message: c.commit.message,
    // GitHub login when the email is linked to an account, else the git author name.
    author: c.author?.login ?? c.commit.author?.name ?? "",
  };
}

function client(token: string | undefined) {
  return new Octokit({
    auth: token || undefined,
    userAgent: "wouldthiswin",
    request: { signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS) },
    // Expected 404s (no README, no package.json) are handled; don't spam logs.
    log: { debug: () => {}, info: () => {}, warn: console.warn, error: () => {} },
  });
}

/**
 * One API call: HEAD commit SHA of the default branch. Used for the cache
 * check before spending the ~8 calls a full fetch takes.
 */
export async function fetchLatestSha(
  ref: RepoRef,
  token: string | undefined = process.env.GITHUB_TOKEN,
): Promise<string> {
  try {
    const { data } = await client(token).repos.listCommits({
      owner: ref.owner,
      repo: ref.repo,
      per_page: 1,
    });
    if (data.length === 0) throw new GitHubError("emptyRepo");
    return data[0].sha;
  } catch (err) {
    throw toGitHubError(err);
  }
}

export async function fetchRepoData(
  repoUrl: string,
  token: string | undefined = process.env.GITHUB_TOKEN,
): Promise<RawRepoData> {
  const ref = parseRepoUrl(repoUrl);
  if (!ref) throw new GitHubError("invalidUrl");

  const gh = client(token);
  const { owner, repo } = ref;
  const raw = { mediaType: { format: "raw" } } as const;

  try {
    const { data: r } = await gh.repos.get({ owner, repo });
    if (r.private) throw new GitHubError("notFound");

    const branch = r.default_branch;
    const [readmeRes, commitsRes, countRes, pkgRes, reqRes] = await Promise.all([
      orNull(gh.repos.getReadme({ owner, repo, ...raw })),
      gh.repos.listCommits({ owner, repo, sha: branch, per_page: COMMITS_LIMIT }),
      gh.repos.listCommits({ owner, repo, sha: branch, per_page: 1 }),
      orNull(gh.repos.getContent({ owner, repo, path: "package.json", ...raw })),
      orNull(gh.repos.getContent({ owner, repo, path: "requirements.txt", ...raw })),
    ]);

    const apiCommits = commitsRes.data as ApiCommit[];
    if (apiCommits.length === 0) throw new GitHubError("emptyRepo");
    const commits = apiCommits.map(toCommitInfo);
    const head = apiCommits[0];

    const commitCount = lastPageFromLink(countRes.headers.link) ?? countRes.data.length;

    // Root commit: last in the list if we already have the whole history,
    // otherwise the last page of a per_page=1 listing.
    const rootApiCommit: ApiCommit =
      commitCount <= apiCommits.length
        ? apiCommits[apiCommits.length - 1]
        : ((
            await gh.repos.listCommits({ owner, repo, sha: branch, per_page: 1, page: commitCount })
          ).data[0] as ApiCommit);

    // A root commit has no parent, so every file in its tree was added by it.
    // Reading its recursive tree avoids the single-commit endpoint's paginated
    // (and 3,000-file-capped) file list entirely.
    const sameTree = rootApiCommit.commit.tree.sha === head.commit.tree.sha;
    const [headTree, rootTree] = await Promise.all([
      gh.git.getTree({ owner, repo, tree_sha: head.commit.tree.sha, recursive: "true" }),
      sameTree
        ? null
        : gh.git.getTree({
            owner,
            repo,
            tree_sha: rootApiCommit.commit.tree.sha,
            recursive: "true",
          }),
    ]);
    const rootTreeData = rootTree?.data ?? headTree.data;

    const blobs = (entries: { path?: string; type?: string }[]) =>
      entries.filter((e) => e.type === "blob" && e.path).map((e) => e.path as string);

    const shallow = headTree.data.tree.filter(
      (e) => e.path && e.path.split("/").length <= TREE_MAX_DEPTH,
    );

    const readmeFull = typeof readmeRes?.data === "string" ? readmeRes.data : "";
    const asText = (res: { data: unknown } | null) =>
      typeof res?.data === "string" ? res.data : null;

    // Monorepos keep their dependencies one or two folders down (backend/, frontend/).
    const headBlobs = blobs(headTree.data.tree);
    const nestedPaths = headBlobs
      .filter((p) => p.includes("/") && p.split("/").length <= 3 && MANIFEST.test(p))
      .filter((p) => !/(^|\/)(node_modules|vendor|dist|build)\//.test(p))
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
      .slice(0, NESTED_MANIFESTS);
    const nestedManifests = (
      await Promise.all(
        nestedPaths.map(async (path) => {
          const res = await orNull(gh.repos.getContent({ owner, repo, path, ...raw }));
          const text = asText(res);
          return text ? { path, text } : null;
        }),
      )
    ).filter((m): m is { path: string; text: string } => m !== null);

    return {
      ref,
      meta: {
        fullName: r.full_name,
        description: r.description,
        homepage: r.homepage || null,
        language: r.language,
        topics: r.topics ?? [],
        stars: r.stargazers_count,
        forks: r.forks_count,
        defaultBranch: branch,
        createdAt: r.created_at,
        pushedAt: r.pushed_at,
      },
      readmeFull,
      readme: readmeFull.slice(0, README_MAX_CHARS),
      tree: shallow.slice(0, TREE_MAX_ENTRIES).map((e) => ({
        path: e.path as string,
        type: e.type as TreeEntry["type"],
      })),
      treeEntriesTruncated: shallow.length > TREE_MAX_ENTRIES || headTree.data.truncated,
      headFilePaths: headBlobs,
      headTreeTruncated: headTree.data.truncated,
      commits,
      commitCount,
      latestSha: head.sha,
      rootCommit: {
        ...toCommitInfo(rootApiCommit),
        filePaths: blobs(rootTreeData.tree),
        treeTruncated: rootTreeData.truncated,
      },
      packageJson: asText(pkgRes),
      requirementsTxt: asText(reqRes),
      nestedManifests,
    };
  } catch (err) {
    throw toGitHubError(err);
  }
}

/**
 * Fetches the files the scan will read, at the scanned commit. Unreadable ones (missing,
 * binary, minified, generated) are left out, so callers can tell what was actually read.
 */
export async function fetchSources(
  ref: RepoRef,
  sha: string,
  paths: readonly string[],
  token: string | undefined = process.env.GITHUB_TOKEN,
): Promise<Source[]> {
  const gh = client(token);
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        const res = await orNull(
          gh.repos.getContent({ owner: ref.owner, repo: ref.repo, path, ref: sha, mediaType: { format: "raw" } }),
        );
        const text = typeof res?.data === "string" ? readableText(res.data) : null;
        return text === null ? null : { path, text };
      } catch (err) {
        // One unreadable file shouldn't sink the scan; it just isn't read.
        console.warn(JSON.stringify({ event: "scan.source", path, error: String(err) }));
        return null;
      }
    }),
  );
  return results.filter((s): s is Source => s !== null);
}
