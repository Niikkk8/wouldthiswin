import { z } from "zod";
import { badRequest, fail } from "@/lib/api";
import { errorText, log } from "@/lib/log";
import { ownerHash, setVisibility } from "@/lib/session-store";

const Body = z.object({ shareable: z.boolean().optional(), listed: z.boolean().optional() });

/**
 * PUT {shareable?, listed?}: the owner's opt-ins for a finished review. Both start off.
 * Listing needs sharing; turning sharing off also unlists.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/sessions/[id]/visibility">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  try {
    const next = await setVisibility(id, await ownerHash(), parsed.data);
    if (!next) return fail("notFound");
    log.info("session.visibility", { id, ...next });
    return Response.json(next);
  } catch (err) {
    log.error("session.visibility.error", { id, error: errorText(err) });
    return fail("judgeFailed");
  }
}
