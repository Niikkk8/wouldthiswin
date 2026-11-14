import { badRequest, clientIp, fail, limitKey } from "@/lib/api";
import { hashIp } from "@/lib/db";
import { errorText, log } from "@/lib/log";
import { OrganizerRequest } from "@/lib/organizers";
import { saveOrganizerRequest } from "@/lib/session-store";

/** POST the "add your hackathon" form. Stored for review; nothing is published from it. */
export async function POST(req: Request) {
  const parsed = OrganizerRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const r = parsed.data;
  try {
    const saved = await saveOrganizerRequest(
      {
        name: r.name,
        url: r.url,
        starts_at: r.startsAt,
        ends_at: r.endsAt,
        rubric: r.rubric,
        tracks: r.tracks,
        contact: r.contact,
      },
      hashIp(limitKey(clientIp(req))),
    );
    if (!saved) return fail("rateLimited");
    log.info("organizers.request", { name: r.name });
    return Response.json({ ok: true });
  } catch (err) {
    log.error("organizers.error", { error: errorText(err) });
    return fail("judgeFailed");
  }
}
