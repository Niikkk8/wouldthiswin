import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { cutoffs, forgetAnswers } from "@/lib/retention";
import type { Answer, Panel } from "@/lib/session";

// The daily retention job (vercel.json crons). Vercel sends `Authorization: Bearer
// $CRON_SECRET`; anything else is refused. See lib/retention.ts for the rules.

export const maxDuration = 60;
const BATCH = 200;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const cut = cutoffs(Date.now());
  const counts = { answersForgotten: 0, sourcesCleared: 0, cacheDeleted: 0 };

  try {
    // 1. Answers and chat older than 30 days. `forgotten_at` marks rows already done.
    for (;;) {
      const { data, error } = await db()
        .from("sessions")
        .select("id, answers, panel")
        .lt("created_at", cut.answers)
        .is("forgotten_at", null)
        .limit(BATCH)
        .returns<{ id: string; answers: Answer[]; panel: Panel | null }[]>();
      if (error) throw error;
      if (!data.length) break;
      for (const row of data) {
        const { error: e } = await db()
          .from("sessions")
          .update({ ...forgetAnswers(row), forgotten_at: new Date().toISOString() })
          .eq("id", row.id);
        if (e) throw e;
        counts.answersForgotten++;
      }
      if (data.length < BATCH) break;
    }

    // 2. File contents of sessions that never reached the review, after a day.
    const { data: cleared, error: e2 } = await db()
      .from("sessions")
      .update({ sources: [] })
      .lt("created_at", cut.sources)
      .neq("sources", "[]")
      .select("id");
    if (e2) throw e2;
    counts.sourcesCleared = cleared.length;

    // 3. The scan cache after 24 hours.
    const { data: gone, error: e3 } = await db()
      .from("scan_cache")
      .delete()
      .lt("created_at", cut.cache)
      .select("repo_url");
    if (e3) throw e3;
    counts.cacheDeleted = gone.length;
  } catch (err) {
    console.error(JSON.stringify({ event: "retention.failed", error: err instanceof Error ? err.message : String(err), ...counts }));
    return Response.json({ ok: false, ...counts }, { status: 500 });
  }

  console.log(JSON.stringify({ event: "retention.done", ...counts }));
  return Response.json({ ok: true, ...counts });
}
