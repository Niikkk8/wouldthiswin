import { z } from "zod";
import { copy } from "@/lib/copy";
import {
  checkLimits,
  completeJudgment,
  failJudgment,
  findCached,
  hashIp,
  hashPitch,
  newId,
  reserve,
} from "@/lib/db";
import { checkDemo } from "@/lib/demo-check";
import { fetchLatestSha, fetchRepoData, GitHubError, parseRepoUrl } from "@/lib/github";
import { judge, JudgeError } from "@/lib/judge";
import { computeSignals, FORMATS } from "@/lib/signals";

// GitHub (~20s worst case) + two model attempts (2 x 18s).
export const maxDuration = 60;

type ErrorKey = keyof typeof copy.errors;

const STATUS: Record<ErrorKey, number> = {
  invalidUrl: 400,
  notFound: 404,
  emptyRepo: 422,
  emptyReadme: 422,
  rateLimited: 429,
  dailyCap: 429,
  githubDown: 503,
  judgeFailed: 502,
};

function fail(key: ErrorKey) {
  return Response.json({ error: key, message: copy.errors[key] }, { status: STATUS[key] });
}

const Body = z.object({
  repoUrl: z.string().max(500),
  demoUrl: z.string().max(2048).optional().nullable(),
  pitch: z.string().optional().nullable(),
  format: z.enum(FORMATS).optional().nullable(),
});

function normalizeDemoUrl(input: string | null | undefined): string {
  const s = input?.trim() ?? "";
  if (!s) return "";
  try {
    return new URL(s).href;
  } catch {
    return s; // checkDemo will report it as invalid; still part of the cache key
  }
}

function clientIp(req: Request): string {
  // On Vercel these are set by the platform, not passed through from the client.
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "badRequest" }, { status: 400 });
  }
  const ref = parseRepoUrl(body.repoUrl);
  if (!ref) return fail("invalidUrl");

  const pitch = body.pitch?.trim() || null;
  if (pitch && pitch.length > 280) return Response.json({ error: "badRequest" }, { status: 400 });
  const demoUrl = normalizeDemoUrl(body.demoUrl);
  const format = body.format ?? "unknown";
  // Pitch and format both change the verdict, so both are part of the cache key.
  const pitchHash = hashPitch(`${format}\n${pitch ?? ""}`);

  let ipHash: string;
  try {
    ipHash = hashIp(clientIp(req));
  } catch (err) {
    console.error(JSON.stringify({ event: "judge.config", error: String(err) }));
    return fail("judgeFailed");
  }

  try {
    // Cache hits never count toward the limits.
    const latestSha = await fetchLatestSha(ref);
    const cachedId = await findCached({ repoUrl: ref.url, latestSha, demoUrl, pitchHash });
    if (cachedId) return Response.json({ id: cachedId, cached: true });

    // Cheap check before the full fetch, which costs ~8 GitHub calls.
    const pre = await checkLimits(ipHash);
    if (pre !== "ok") return fail(pre);

    const [raw, demo] = await Promise.all([
      fetchRepoData(ref.url),
      demoUrl ? checkDemo(demoUrl) : Promise.resolve(null),
    ]);
    if (!raw.readmeFull.trim()) return fail("emptyReadme");
    const signals = computeSignals(raw, demo, format);

    // Re-checks the limits under a lock and inserts a pending row, so
    // concurrent requests can't get past them.
    const id = newId();
    const reserved = await reserve(ipHash, {
      id,
      repoUrl: ref.url,
      latestSha: raw.latestSha,
      demoUrl,
      pitch,
      pitchHash,
      signals,
    });
    if (reserved !== "ok") return fail(reserved);

    try {
      const { result, usage } = await judge(raw, signals, pitch, demoUrl || null);
      await completeJudgment(id, result, usage);
      console.log(
        JSON.stringify({
          event: "judge.done",
          id,
          repo: ref.url,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
        }),
      );
      return Response.json({ id, cached: false });
    } catch (err) {
      const usage = err instanceof JudgeError ? err.usage : { inputTokens: 0, outputTokens: 0 };
      console.error(
        JSON.stringify({
          event: "judge.failed",
          id,
          repo: ref.url,
          error: err instanceof Error ? err.message : String(err),
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
        }),
      );
      await failJudgment(id, usage);
      return fail("judgeFailed");
    }
  } catch (err) {
    if (err instanceof GitHubError) {
      if (err.code === "githubDown") {
        console.error(JSON.stringify({ event: "github.error", repo: ref.url, error: err.message }));
      }
      return fail(err.code);
    }
    console.error(
      JSON.stringify({
        event: "judge.error",
        repo: ref.url,
        error: err instanceof Error ? err.message : JSON.stringify(err),
      }),
    );
    return fail("judgeFailed");
  }
}
