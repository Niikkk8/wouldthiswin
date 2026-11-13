import { badgeSvg, notJudgedBadgeSvg } from "@/lib/badge";
import { log } from "@/lib/log";
import { tierFor } from "@/lib/odds";
import { parseRepoUrl } from "@/lib/repo-url";
import { loadLatestShareable } from "@/lib/session-store";

const HEADERS = {
  "content-type": "image/svg+xml; charset=utf-8",
  "cache-control": "public, max-age=3600, s-maxage=3600",
  "x-content-type-options": "nosniff",
};

/**
 * GET /api/badge/OWNER/REPO (".svg" optional): the repo's latest shareable verdict as a
 * shields-style badge, or a neutral "not judged yet" one. Cached for an hour, so a new
 * verdict shows up within the hour.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/badge/[owner]/[repo]">) {
  const { owner, repo } = await ctx.params;
  const ref = parseRepoUrl(`github.com/${owner}/${repo.replace(/\.svg$/i, "")}`);
  if (!ref) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  try {
    const latest = await loadLatestShareable(`${ref.owner}/${ref.repo}`);
    const svg = latest ? badgeSvg(latest.odds, tierFor(latest.odds)) : notJudgedBadgeSvg();
    return new Response(svg, { headers: HEADERS });
  } catch (err) {
    log.error("badge.repo", { repo: ref.url, error: err instanceof Error ? err.message : String(err) });
    return new Response(notJudgedBadgeSvg(), { headers: { ...HEADERS, "cache-control": "public, max-age=300" } });
  }
}
