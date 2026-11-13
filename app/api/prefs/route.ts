import { z } from "zod";
import { badRequest, fail } from "@/lib/api";
import { errorText, log } from "@/lib/log";
import { ensureOwner, loadPrefs, ownerHash, savePrefs } from "@/lib/session-store";

const Body = z.object({ extendedTime: z.boolean() });

/** This browser's settings. Private to the owner cookie; nothing here is ever public. */
export async function GET() {
  try {
    return Response.json(await loadPrefs(await ownerHash()));
  } catch (err) {
    log.error("prefs.load", { error: errorText(err) });
    return fail("judgeFailed");
  }
}

/** Saves the settings. They apply to sessions started from now on, never one already running. */
export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  try {
    await savePrefs(await ensureOwner(), parsed.data);
    return Response.json(parsed.data);
  } catch (err) {
    log.error("prefs.save", { error: errorText(err) });
    return fail("judgeFailed");
  }
}
