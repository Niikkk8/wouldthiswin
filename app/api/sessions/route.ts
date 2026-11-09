import { z } from "zod";
import { badRequest, clientIp, fail, limitKey } from "@/lib/api";
import { ID_RE, hashIp, newId } from "@/lib/db";
import { fetchLatestSha, GitHubError, parseRepoUrl } from "@/lib/github";
import { parseDemoLink } from "@/lib/demo-link";
import {
  checkLimits,
  ensureOwner,
  loadOwnReview,
  ownerHash,
  reserveSession,
  setDemoUrl,
  setPreviousId,
} from "@/lib/session-store";

const Body = z.object({
  repoUrl: z.string().max(500),
  demoUrl: z.string().max(500).optional(),
  /** A re-review: the finished review, by this browser, of the same repo, that this one follows. */
  previousId: z.string().regex(ID_RE).optional(),
});

/**
 * Starts a session: checks the repo exists and the limits. The scan runs from act 1.
 * A re-review must follow this browser's own finished review of the same repo, and the
 * repo must have new commits since: the panel only looks again when there's something new.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest();
  }
  const ref = parseRepoUrl(body.repoUrl);
  if (!ref) return fail("invalidUrl");
  // Optional. Checked again over the network (SSRF-safe) when the scan runs.
  const demo = body.demoUrl?.trim() ? parseDemoLink(body.demoUrl) : null;
  if (body.demoUrl?.trim() && !demo) return fail("invalidDemo");

  let ipHash: string;
  try {
    ipHash = hashIp(limitKey(clientIp(req)));
  } catch (err) {
    console.error(JSON.stringify({ event: "session.config", error: String(err) }));
    return fail("judgeFailed");
  }

  try {
    const previous = body.previousId ? await loadOwnReview(body.previousId, await ownerHash()) : null;
    if (body.previousId && !previous) return fail("notReviewed");
    if (previous && previous.loaded.repoUrl !== ref.url) return fail("notReviewed");

    const pre = await checkLimits(ipHash);
    if (pre !== "ok") return fail(pre);

    const latestSha = await fetchLatestSha(ref);
    if (previous && previous.loaded.latestSha === latestSha) return fail("nothingNew");
    const owner = await ensureOwner();
    const id = newId();
    const repo = `${ref.owner}/${ref.repo}`;
    const reserved = await reserveSession({ id, repoUrl: ref.url, repo, latestSha, owner, ipHash });
    if (reserved !== "ok") return fail(reserved);
    // A re-review keeps the demo link the team gave last round, unless they gave a new one.
    const demoUrl = demo?.url ?? previous?.loaded.demoUrl ?? null;
    if (demoUrl) await setDemoUrl(id, demoUrl);
    if (previous) await setPreviousId(id, body.previousId!);

    console.log(JSON.stringify({ event: "session.start", id, repo: ref.url, ...(previous ? { previousId: body.previousId } : {}) }));
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
