// Shared by the server (GitHub fetch) and the browser (form feedback).

export type RepoRef = { owner: string; repo: string; url: string };

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Accepts github.com/owner/repo in common shapes; returns a canonical URL. */
export function parseRepoUrl(input: string): RepoRef | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;
  const [owner, repoRaw] = u.pathname.split("/").filter(Boolean);
  if (!owner || !repoRaw) return null;
  const repo = repoRaw.replace(/\.git$/i, "");
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === "." || repo === "..") {
    return null;
  }
  return {
    owner: owner.toLowerCase(),
    repo: repo.toLowerCase(),
    url: `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`,
  };
}
