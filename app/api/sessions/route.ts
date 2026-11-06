import { z } from "zod";
import { badRequest, clientIp, fail } from "@/lib/api";
import { hashIp, newId } from "@/lib/db";
import { fetchLatestSha, GitHubError, parseRepoUrl } from "@/lib/github";
import { checkLimits, ensureOwner, reserveSession } from "@/lib/session-store";

const Body = z.object({ repoUrl: z.string().max(500) });

/** Starts a session: checks the repo exists and the limits. The scan runs from act 1. */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest();
  }
  const ref = parseRepoUrl(body.repoUrl);
  if (!ref) return fail("invalidUrl");

  let ipHash: string;
  try {
    ipHash = hashIp(clientIp(req));
  } catch (err) {
    console.error(JSON.stringify({ event: "session.config", error: String(err) }));
    return fail("judgeFailed");
  }

  try {
    const pre = await checkLimits(ipHash);
    if (pre !== "ok") return fail(pre);

    const latestSha = await fetchLatestSha(ref);
    const owner = await ensureOwner();
    const id = newId();
    const repo = `${ref.owner}/${ref.repo}`;
    const reserved = await reserveSession({ id, repoUrl: ref.url, repo, latestSha, owner, ipHash });
    if (reserved !== "ok") return fail(reserved);

    console.log(JSON.stringify({ event: "session.start", id, repo: ref.url }));
    return Response.json({ id });
  } catch (err) {
    if (err instanceof GitHubError) {
      if (err.code === "githubDown") {
        console.error(JSON.stringify({ event: "github.error", repo: ref.url, error: err.message }));
      }
      return fail(err.code);
    }
    console.error(
      JSON.stringify({
        event: "session.error",
        repo: ref.url,
        error: err instanceof Error ? err.message : JSON.stringify(err),
      }),
    );
    return fail("judgeFailed");
  }
}
