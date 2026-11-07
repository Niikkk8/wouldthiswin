import { ID_RE, db } from "@/lib/db";
import { MAX_EVENTS_PER_REVIEW, ShareEvent } from "@/lib/share-events";

const noContent = () => new Response(null, { status: 204 });

/**
 * Logs one share-screen action for a finished review. Anyone who can see the review can
 * share it (the phone page opened from the QR code isn't the owner), so this is public;
 * it only ever adds a counted row, capped per review.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/share">) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return Response.json({ error: "notFound" }, { status: 404 });
  const parsed = ShareEvent.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "badRequest" }, { status: 400 });

  const { data: s, error } = await db().from("sessions").select("act").eq("id", id).maybeSingle<{ act: string }>();
  if (error) {
    console.error(JSON.stringify({ event: "share.lookup", id, error: error.message }));
    return noContent();
  }
  if (!s || (s.act !== "verdict" && s.act !== "share")) return Response.json({ error: "notFound" }, { status: 404 });

  const { count } = await db().from("share_events").select("id", { count: "exact", head: true }).eq("session_id", id);
  if ((count ?? 0) >= MAX_EVENTS_PER_REVIEW) return noContent();

  const { error: insertError } = await db()
    .from("share_events")
    .insert({ session_id: id, kind: parsed.data.kind, format: parsed.data.format ?? null });
  if (insertError) console.error(JSON.stringify({ event: "share.log", id, error: insertError.message }));
  return noContent();
}
