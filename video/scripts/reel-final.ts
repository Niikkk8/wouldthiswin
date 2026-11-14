// The final reel from one continuous talking-head take: `npm run reel:final`.
//
//  1. footage/raw/full.* (any extension): transcribed locally with whisper.cpp (DTW word times).
//  2. Every pause over 0.2 s cut to 0.08 s, filler words and false starts (a word or phrase
//     said twice in a row) cut, the start and end trimmed to the words.
//  3. The face cut: HDR (HLG/PQ) tone-mapped to SDR, 1080x1920 30 fps; the voice cleaned
//     (high-pass, gentle denoise, compression).
//  4. Each line matched by phrase to a beat in reel/final.json: face, or B-roll from the app
//     captures (public/capture/v3), or the end card; sound hits where a beat asks for one.
//  5. Rendered with the Reel composition (word-by-word captions, punch-ins on the emphasis
//     words), mastered to -14 LUFS: out/reel_final_9x16.mp4 and out/reel_final_cover.png.
//
// Usage: npm run reel:final [-- --model small.en]

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { FinalBeat, FinalPlan } from "../src/reel/Final";
import type { Broll, Word } from "../src/reel/Reel";
import type { Cam } from "../src/v3/footage";
import { CACHE, ffmpeg, master, OUT, probe, PUBLIC, render, still, VIDEO } from "./lib";
import { transcribeWords, type W } from "./whisper-words";

const RAW = join(VIDEO, "footage", "raw");
const WORK = join(CACHE, "reel-final");
const PUB = join(PUBLIC, "reel-final");
const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const MODEL = arg("model", process.env.WHISPER_MODEL ?? "small.en");
const FILLERS = new Set(["um", "uh", "erm", "er", "ah", "hmm", "mm", "uhm", "like,"]);
const PAUSE = 0.2;
const KEEP_PAUSE = 0.08;

/** A keyframe time: seconds into the beat, a percentage of the beat ("60%"), or "drop". */
type BeatCam = Omit<Cam, "at"> & { at: number | string };
type Beat = {
  match: string;
  visual: "face" | "broll" | "card";
  broll?: Omit<Broll, "cams"> & { cams?: BeatCam[] };
  hit?: "finding" | "drop" | "end";
  hitAt?: number;
  dropOn?: string;
  dropAt?: number;
  label?: string;
};
type Config = { target: { min: number; max: number }; corrections: Record<string, string>; emphasis: string[]; endHold: number; beats: Beat[] };

const cfg: Config = JSON.parse(readFileSync(join(VIDEO, "reel", "final.json"), "utf8"));
const source = existsSync(RAW) ? readdirSync(RAW).find((f) => /^full\.[a-z0-9]+$/i.test(f) && extname(f)) : undefined;
if (!source) {
  console.error("no footage: put the take in video/footage/raw/full.mp4 (any extension)");
  process.exit(1);
}
const SRC = join(RAW, source);
rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });
mkdirSync(WORK, { recursive: true });

const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, "");

// ---------------------------------------------------------------- 1. words

const wav = join(WORK, "full.16k.wav");
ffmpeg(["-i", SRC, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
let words: W[] = await transcribeWords(wav, SRC, MODEL);
console.log(`heard: ${words.map((w) => w.text).join(" ")}`);

// ---------------------------------------------------------------- 2. what to keep

// Fillers out, then false starts: a run of 1 to 4 words said again straight away keeps only the retake.
words = words.filter((w) => !FILLERS.has(norm(w.text)));
for (let i = 0; i < words.length; i++) {
  for (let n = 4; n >= 1; n--) {
    const a = words.slice(i, i + n).map((w) => norm(w.text));
    const b = words.slice(i + n, i + 2 * n).map((w) => norm(w.text));
    if (a.length === n && a.join(" ") === b.join(" ")) {
      words.splice(i, n);
      i = Math.max(-1, i - 2);
      break;
    }
  }
}

// Kept spans of the take: one per run of words without a long pause.
const spans: [number, number][] = [];
for (const [i, w] of words.entries()) {
  const prev = words[i - 1];
  if (!prev || w.start - prev.end > PAUSE) spans.push([Math.max(0, w.start - (prev ? KEEP_PAUSE / 2 : 0.1)), w.end]);
  else spans[spans.length - 1][1] = w.end;
}
spans[spans.length - 1][1] += 0.3;
for (let i = 0; i + 1 < spans.length; i++) spans[i][1] = Math.min(spans[i][1] + KEEP_PAUSE / 2, spans[i + 1][0]);

// Where each moment of the take lands in the cut.
const outAt = (t: number) => {
  let acc = 0;
  for (const [a, b] of spans) {
    if (t <= b) return acc + Math.max(0, t - a);
    acc += b - a;
  }
  return acc;
};
const speech = spans.reduce((s, [a, b]) => s + b - a, 0);

// ---------------------------------------------------------------- 3. the face cut

const hdr = /arib-std-b67|smpte2084/.test(JSON.stringify(probe(SRC).streams));
const tone = hdr
  ? "zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,"
  : "";
const parts = spans.map(([a, b], i) => `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, b - a - 0.012)}:d=0.012[a${i}];`).join("");
const cat = spans.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${spans.length}:v=1:a=1[v][a]`;
ffmpeg([
  "-i", SRC, "-filter_complex",
  `${parts}${cat};[v]${tone}scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p[vo];[a]highpass=f=80,afftdn=nf=-28,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=3,aresample=48000[ao]`,
  "-map", "[vo]", "-map", "[ao]", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-c:a", "aac", "-b:a", "256k", "-ac", "2", "-movflags", "+faststart", join(PUB, "face.mp4"),
]);

// ---------------------------------------------------------------- 4. the edit

let fixed = words.map((w) => ({ ...w, start: outAt(w.start), end: outAt(w.end) }));
// Corrections (what whisper hears for the product's name), applied to the caption text.
for (const [heard, say] of Object.entries(cfg.corrections)) {
  const h = heard.split(" ");
  for (let i = 0; i + h.length <= fixed.length; i++) {
    if (fixed.slice(i, i + h.length).map((w) => norm(w.text)).join(" ") !== h.join(" ")) continue;
    const tail = fixed[i + h.length - 1].text.match(/[.,!?]+$/)?.[0] ?? "";
    const s = say.split(" ");
    const span = fixed.slice(i, i + h.length);
    const rep = s.map((t, k) => ({ ...span[Math.min(k, span.length - 1)], text: t + (k === s.length - 1 ? tail : "") }));
    fixed.splice(i, h.length, ...rep);
  }
}
const emph = new Set(cfg.emphasis);
const capWords: Word[] = fixed.map((w) => ({ text: w.text, start: w.start, end: w.end, emph: emph.has(norm(w.text)) }));

// Each beat starts at its phrase.
const find = (phrase: string, from = 0) => {
  const p = norm(phrase).split(" ");
  for (let i = from; i + p.length <= fixed.length; i++) if (fixed.slice(i, i + p.length).every((w, k) => norm(w.text) === p[k])) return i;
  return -1;
};
const starts: { beat: Beat; at: number; word: number }[] = [];
let cursor = 0;
for (const beat of cfg.beats) {
  const i = find(beat.match, cursor);
  if (i < 0) {
    console.warn(`  beat not heard, skipped: "${beat.match}"`);
    continue;
  }
  starts.push({ beat, at: i === 0 ? 0 : fixed[i].start - 0.04, word: i });
  cursor = i + 1;
}

const beats: FinalBeat[] = [];
const ev = { cardIn: [] as number[], cardOut: [] as number[], swap: [] as number[], labels: [] as number[], keys: [] as number[], questions: [] as number[], drops: [] as number[] };
const total = speech + cfg.endHold;
const meta = (clip: string): { frames: { typed: number }[] } => JSON.parse(readFileSync(join(PUBLIC, "capture", "v3", `${clip}.json`), "utf8"));
starts.forEach(({ beat, at, word }, k) => {
  const end = k + 1 < starts.length ? starts[k + 1].at : total;
  const dur = end - at;
  if (beat.visual === "face") beats.push({ kind: "face", start: at, dur });
  else if (beat.visual === "card") beats.push({ kind: "card", start: at, dur });
  else if (beat.broll) {
    const b = beat.broll;
    let from = b.from;
    let cams: Cam[] | undefined;
    let dropAt: number | undefined;
    // A beat that lands on a word (the odds dropping on "drop"): the capture is started so the
    // change on screen happens as the word is said.
    if (beat.dropOn && beat.dropAt !== undefined) {
      const w = find(beat.dropOn, word);
      dropAt = w >= 0 ? fixed[w].start - at : dur / 2;
      from = Math.max(0, beat.dropAt - dropAt);
      ev.drops.push(at + dropAt);
    }
    const when = (at: number | string) => (at === "drop" ? (dropAt ?? dur / 2) : typeof at === "string" && at.endsWith("%") ? (dur * parseFloat(at)) / 100 : Number(at));
    cams = b.cams?.map((c) => ({ ...c, at: when(c.at) }));
    // Keystrokes where the capture types (the repo field).
    const frames = meta(b.clip).frames;
    const rate = b.rate ?? 1;
    for (let f = Math.round(from * 30) + 1; f < Math.min(frames.length, Math.round((from + dur * rate) * 30)); f++)
      if (frames[f].typed > frames[f - 1].typed) ev.keys.push(at + (f / 30 - from) / rate);
    if (/asks|follow-up/i.test(beat.label ?? "")) ev.questions.push(at + 0.25);
    if (beat.label) ev.labels.push(at);
    beats.push({ kind: "broll", start: at, dur, label: beat.label, dropAt, broll: { ...b, from, cams, shake: dropAt === undefined ? undefined : [dropAt] } });
  }
});
// Card entrances, exits and content swaps, for the sound.
beats.forEach((b, i) => {
  if (b.kind !== "broll") return;
  const prev = beats[i - 1];
  const next = beats[i + 1];
  if (prev?.kind === "broll") ev.swap.push(b.start);
  else ev.cardIn.push(b.start);
  if (next?.kind !== "broll" && next?.kind !== "card") ev.cardOut.push(b.start + b.dur);
});
const endBeat = beats.find((b) => b.kind === "card");
const events = {
  duration: total,
  words: capWords.map((w) => ({ start: w.start, end: w.end })),
  punches: capWords.filter((w) => w.emph).map((w) => w.start),
  pulseFrom: beats[1]?.start ?? 2,
  end: endBeat?.start ?? total - cfg.endHold,
  ...ev,
};
writeFileSync(join(PUB, "events.json"), JSON.stringify(events));
const r = spawnSync("python", ["-m", "sfx.cues.reel_final", join(PUB, "events.json"), join(PUB, "sfx.wav")], { cwd: VIDEO, encoding: "utf8" });
if (r.status !== 0) throw new Error(r.stderr);
const plan: FinalPlan = { duration: total, face: "reel-final/face.mp4", speech, words: capWords, beats, sfx: "reel-final/sfx.wav" };
writeFileSync(join(WORK, "plan.json"), JSON.stringify(plan, null, 1));
console.log(`cut: ${speech.toFixed(1)} s of speech + ${cfg.endHold} s end card = ${total.toFixed(1)} s${total < cfg.target.min || total > cfg.target.max ? ` (target ${cfg.target.min} to ${cfg.target.max} s)` : ""}`);
for (const b of beats) console.log(`  ${b.start.toFixed(2).padStart(6)}  ${b.dur.toFixed(2)}  ${b.kind}${b.broll ? " " + b.broll.clip : ""}${b.label ? "  [" + b.label + "]" : ""}`);

if (process.argv.includes("--no-render")) process.exit(0);
mkdirSync(OUT, { recursive: true });
const raw = join(WORK, "reel_final.raw.mp4");
await render("reel-final-9x16", raw, { plan });
const m = master(raw, join(OUT, "reel_final_9x16.mp4"), -14);
console.log(`out/reel_final_9x16.mp4  ${Number(m.after.input_i).toFixed(1)} LUFS, ${Number(m.after.input_tp).toFixed(1)} dBTP`);
// Cover: the odds dropping, mid-punch, caption up.
await still("reel-final-9x16", join(OUT, "reel_final_cover.png"), Math.round(((ev.drops[0] ?? 1) + 0.4) * 30), { plan });
console.log("out/reel_final_cover.png");
