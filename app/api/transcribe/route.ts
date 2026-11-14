import { z } from "zod";
import { badRequest, fail } from "@/lib/api";
import { ID_RE } from "@/lib/db";
import { errorText, log } from "@/lib/log";
import { MAX_ANSWER_LENGTH, MAX_QUESTIONS, uploadRefusal } from "@/lib/session";
import { addStepTiming, loadSession, ownerHash } from "@/lib/session-store";
import {
  MAX_AUDIO_BYTES,
  TranscribeError,
  audioType,
  cleanTranscript,
  transcribe,
} from "@/lib/transcribe";

// Whisper on a 90-second clip takes a few seconds; leave room for a slow upload.
export const maxDuration = 30;

const Fields = z.object({
  session: z.string().regex(ID_RE),
  question: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_QUESTIONS - 1),
});

/**
 * POST multipart {session, question, audio}: the owner's voice answer, transcribed. Accepted
 * only for the open question, when its recording started before the buzzer and the upload
 * arrives within the grace (lib/deadline.ts). The audio is never stored. The transcript goes
 * back to the answer box, where it's an answer like any typed one.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest();
  }
  const fields = Fields.safeParse({ session: form.get("session"), question: form.get("question") });
  const audio = form.get("audio");
  if (!fields.success || !(audio instanceof Blob)) return badRequest();
  const type = audioType(audio.type);
  if (!type || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) return badRequest();

  const { session: id, question } = fields.data;
  try {
    const loaded = await loadSession(id, await ownerHash());
    if (!loaded) return fail("notFound");
    const refusal = uploadRefusal(loaded.session, question, Date.now());
    if (refusal) return fail(refusal === "tooLate" ? "tooLate" : "stale", loaded.session);

    const started = Date.now();
    const text = await transcribe(audio, type);
    await addStepTiming(id, "transcribe", Date.now() - started);
    return Response.json({ text: cleanTranscript(text, MAX_ANSWER_LENGTH) });
  } catch (err) {
    if (err instanceof TranscribeError) {
      if (err.reason === "empty") return fail("voiceEmpty");
      log.error("transcribe.failed", { id, reason: err.reason });
      return fail("voiceUnavailable");
    }
    log.error("transcribe.error", { id, error: errorText(err) });
    return fail("voiceUnavailable");
  }
}
