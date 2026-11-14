// Shared by the reel scripts: whisper.cpp (through @remotion/install-whisper-cpp, local, no
// keys) to words with times. Binary and model live in video/whisper.cpp (git-ignored).

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, VIDEO } from "./lib";

export const WHISPER = join(VIDEO, "whisper.cpp");
export const WHISPER_VERSION = "1.5.5";
export type W = { text: string; start: number; end: number; p: number; take?: number };
type Cap = { text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null };

/** whisper.cpp tokens to words: a token without a leading space continues the word before it, bare punctuation sticks to it, DTW times. */
export function tokensToWords(captions: Cap[]): W[] {
  const words: W[] = [];
  for (const x of captions) {
    const raw = x.text;
    const text = raw.trim();
    if (!text || /^\[.*\]$/.test(text)) continue;
    // DTW time (timestampMs) is where the token is actually said; the segment offsets drift.
    const at = (x.timestampMs ?? x.startMs) / 1000;
    const tok = { text, start: at, end: at + Math.max(0.08, (x.endMs - x.startMs) / 1000), p: x.confidence ?? 0.8 };
    const prev = words.at(-1);
    if (prev && (!/^\s/.test(raw) || /^[.,!?;:'")\]-]+$/.test(text))) {
      prev.text += text;
      prev.end = tok.end;
      prev.p = Math.min(prev.p, tok.p);
    } else words.push(tok);
  }
  // A word ends where the next one starts, at the latest.
  for (let i = 0; i + 1 < words.length; i++) words[i].end = Math.min(words[i].end, Math.max(words[i].start + 0.05, words[i + 1].start - 0.02));
  // Non-speech markers ("[BLANK_AUDIO]") arrive in pieces; drop them once whole.
  return words.filter((x) => !/[[\]]/.test(x.text));
}

/** Transcribes a 16 kHz mono WAV to words; cached by the source file's size and time and the model. */
export async function transcribeWords(wav: string, source: string, model = "small.en"): Promise<W[]> {
  const st = statSync(source);
  const dir = join(CACHE, "whisper");
  mkdirSync(dir, { recursive: true });
  const cache = join(dir, `${st.size}.${Math.round(st.mtimeMs)}.${model}.json`);
  let caps: Cap[];
  if (existsSync(cache)) caps = JSON.parse(readFileSync(cache, "utf8"));
  else {
    const w = await import("@remotion/install-whisper-cpp");
    await w.installWhisperCpp({ to: WHISPER, version: WHISPER_VERSION, printOutput: false });
    await w.downloadWhisperModel({ model: model as "small.en", folder: WHISPER, printOutput: false });
    const res = await w.transcribe({ inputPath: wav, whisperPath: WHISPER, whisperCppVersion: WHISPER_VERSION, model: model as "small.en", tokenLevelTimestamps: true, printOutput: false });
    caps = w.toCaptions({ whisperCppOutput: res }).captions;
    writeFileSync(cache, JSON.stringify(caps));
  }
  return tokensToWords(caps);
}
