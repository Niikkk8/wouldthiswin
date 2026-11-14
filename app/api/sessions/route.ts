import { z } from "zod";
import { badRequest, clientIp, fail, limitKey } from "@/lib/api";
import { ID_RE, hashIp, newId } from "@/lib/db";
import { fetchLatestSha, GitHubError, parseRepoUrl } from "@/lib/github";
import { parseDemoLink } from "@/lib/demo-link";
import { eventBySlug, eventStatus } from "@/lib/events";
import { nextReset, type LimitStatus } from "@/lib/limits";
import { log } from "@/lib/log";
import {
  checkLimits,
  ensureOwner,
  lastReviewOf,
  loadOwnReview,
  loadPrefs,
  ownerHash,
  reserveSession,
  setDemoUrl,
  setPreviousId,
  setSettings,
  setSubmission,
} from "@/lib/session-store";
import { MAX_SUBMISSION_CHARS, parseDevpostUrl } from "@/lib/evidence/sources";

const Body = z.object({
  repoUrl: z.string().max(500),
  demoUrl: z.string().max(500).optional(),
  /** A re-review: the finished review, by this browser, of the same repo, that this one follows. */
  previousId: z.string().regex(ID_RE).optional(),
  /** An event's session (/e/[slug]): judged on that event's rubric, while the event is open. */
  eventSlug: z.string().max(60).optional(),
  /** Optional claim sources beyond the README: a Devpost project page and pasted submission text. */
  devpostUrl: z.string().max(300).optional(),
  submissionText: z.string().max(MAX_SUBMISSION_CHARS).optional(),
  /** The event window, if the team gave one: for the private timeline signals. */
  windowStart: z.string().datetime({ offset: true }).optional(),
  windowEnd: z.string().datetime({ offset: true }).optional(),
  /** Sponsor tracks the team is entering, from the event's own list. */
  tracks: z.array(z.string().max(80)).max(10).optional(),
});

/**
 * A cap was hit: the client shows "the judges are asleep" with a countdown to the reset and
 * a way to share this browser's last review, never an error page.
 */
async function asleep(status: Exclude<LimitStatus, "ok">): Promise<Response> {
  const lastReview = await lastReviewOf(await ownerHash()).catch(() => null);
  return fail(status, undefined, {
    asleep: { resetAt: nextReset(new Date()).toISOString(), lastReview },
  });
}

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
    log.error("session.config", { error: String(err) });
    return fail("judgeFailed");
  }

  const devpostUrl = body.devpostUrl?.trim() ? parseDevpostUrl(body.devpostUrl) : null;
  if (body.devpostUrl?.trim() && !devpostUrl) return fail("invalidDevpost");
  const submissionText = body.submissionText?.trim() || null;

  const event = body.eventSlug ? eventBySlug(body.eventSlug) : null;
  if (body.eventSlug && (!event || eventStatus(event, Date.now()) !== "open"))
    return fail("eventClosed");

  try {
    const previous = body.previousId
      ? await loadOwnReview(body.previousId, await ownerHash())
      : null;
    if (body.previousId && !previous) return fail("notReviewed");
    if (previous && previous.loaded.repoUrl !== ref.url) return fail("notReviewed");
    // A re-judge stays with the event the first round was for.
    const eventSlug = previous ? previous.loaded.session.eventSlug : (event?.slug ?? null);

    const pre = await checkLimits(ipHash);
    if (pre !== "ok") return await asleep(pre);

    const latestSha = await fetchLatestSha(ref);
    if (previous && previous.loaded.latestSha === latestSha) return fail("nothingNew");
    const owner = await ensureOwner();
    const id = newId();
    const repo = `${ref.owner}/${ref.repo}`;
    const reserved = await reserveSession({
      id,
      repoUrl: ref.url,
      repo,
      latestSha,
      owner,
      ipHash,
      eventSlug,
    });
    if (reserved !== "ok") return await asleep(reserved);
    // A re-review keeps the demo link the team gave last round, unless they gave a new one.
    const demoUrl = demo?.url ?? previous?.loaded.demoUrl ?? null;
    if (demoUrl) await setDemoUrl(id, demoUrl);
    if (previous) await setPreviousId(id, body.previousId!);
    // Only tracks the event actually lists are kept.
    const known = new Set(event?.sponsorSignatures.map((s) => s.track) ?? []);
    const tracks = (body.tracks ?? []).filter((t) => known.has(t));
    if (devpostUrl || submissionText || body.windowStart || body.windowEnd || tracks.length) {
      await setSubmission(id, {
        devpostUrl,
        text: submissionText,
        start: body.windowStart ?? null,
        end: body.windowEnd ?? null,
        tracks,
      });
    }
    const prefs = await loadPrefs(owner);
    if (prefs.extendedTime) await setSettings(id, prefs);

    log.info("session.start", {
      id,
      repo: ref.url,
      ...(previous ? { previousId: body.previousId } : {}),
    });
    return Response.json({ id });
  } catch (err) {
    if (err instanceof GitHubError) {
      if (err.code === "githubDown") {
        log.error("github.error", { repo: ref.url, error: err.message });
      }
      return fail(err.code);
    }
    log.error("session.error", {
      repo: ref.url,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    });
    return fail("judgeFailed");
  }
}
