import { z } from "zod";
import { badRequest, clientIp, fail, limitKey } from "@/lib/api";
import { hashIp } from "@/lib/db";
import { GitHubError, parseRepoUrl } from "@/lib/github";
import { errorText, log } from "@/lib/log";
import { publicScan } from "@/lib/public-scan";
import { SITE_URL } from "@/lib/site";

// GitHub, then claim extraction and the checks in parallel.
export const maxDuration = 60;

const Body = z.object({ repo: z.string().min(3).max(300) });

/**
 * POST {repo}: "owner/repo" or a GitHub URL. Public repos only. Returns the report and the
 * link to get grilled on it. Used by the CLI; no cookies, no session.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const ref = parseRepoUrl(
    parsed.data.repo.includes("github.com") ? parsed.data.repo : `github.com/${parsed.data.repo}`,
  );
  if (!ref) return fail("invalidUrl");
  try {
    const out = await publicScan(ref, hashIp(limitKey(clientIp(req))));
    if (out.kind === "limited") return fail("rateLimited");
    return Response.json({
      ...out.report,
      cached: out.cached,
      url: `${SITE_URL}/r/${out.report.id}`,
    });
  } catch (err) {
    if (err instanceof GitHubError) return fail(err.code);
    log.error("public.scan", { repo: ref.url, error: errorText(err) });
    return fail("judgeFailed");
  }
}
