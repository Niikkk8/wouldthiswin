// Voice answers: one recording in, its transcript out, through Groq's Whisper endpoint. The
// audio is passed straight through and never stored. The transcript is untrusted, exactly
// like a typed answer: it goes into the same answer box and the same scoring.

import { z } from "zod";

export const TRANSCRIBE_MODEL = "whisper-large-v3-turbo";
const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const TIMEOUT_MS = 15_000;

/** Under Vercel's 4.5 MB request body limit. 90 seconds of Opus is well under 1 MB. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

// What MediaRecorder produces: WebM/Opus in Chrome and Firefox, MP4/AAC in Safari.
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** The base media type ("audio/webm;codecs=opus" is "audio/webm"), or null if it isn't one we take. */
export function audioType(mime: string): string | null {
  const base = mime.split(";")[0].trim().toLowerCase();
  return base in EXTENSIONS ? base : null;
}

const TranscriptBody = z.object({ text: z.string() });

export class TranscribeError extends Error {
  constructor(public reason: "unconfigured" | "upstream" | "empty") {
    super(reason);
  }
}

/** One line, collapsed whitespace, cut at a word boundary to `max` characters. */
export function cleanTranscript(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd();
}

export async function transcribe(
  audio: Blob,
  type: string,
  opts: { apiKey?: string; fetch?: typeof fetch } = {},
): Promise<string> {
  const apiKey = opts.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey) throw new TranscribeError("unconfigured");
  const form = new FormData();
  form.append("file", audio, `answer.${EXTENSIONS[type] ?? "webm"}`);
  form.append("model", TRANSCRIBE_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await (opts.fetch ?? fetch)(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new TranscribeError("upstream");
  const parsed = TranscriptBody.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new TranscribeError("upstream");
  if (!parsed.data.text.trim()) throw new TranscribeError("empty");
  return parsed.data.text;
}
