import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { badRequest, fail } from "@/lib/api";
import { errorText, log } from "@/lib/log";
import { setHidden } from "@/lib/session-store";

const Body = z.object({ id: z.string(), hidden: z.boolean().default(true) });

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** POST {id, hidden?}: the admin takes a verdict off the public board, or puts it back. Bearer ADMIN_SECRET. */
export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  try {
    if (!(await setHidden(parsed.data.id, parsed.data.hidden))) return fail("notFound");
    log.info("admin.hide", parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    log.error("admin.hide.error", { error: errorText(err) });
    return fail("judgeFailed");
  }
}
