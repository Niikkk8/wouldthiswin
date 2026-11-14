// The face reel, from raw clips to finished files, in one command: `npm run reel`.
//
//  1. Finds the raw clips in footage/raw, named by shot (01_hook, 01b_hook, ... 08_broll; any
//     extension, each clip may hold several takes).
//  2. Transcribes each locally with whisper.cpp through @remotion/install-whisper-cpp (binary
//     and model live in video/whisper.cpp, git-ignored; nothing system-wide, no API keys).
//  3. Splits takes on silence (ffmpeg silencedetect), matches each to its line in
//     reel/script.json and picks the best: closest to the script, fewest fillers, no long
//     stalls, confident words, later take on a tie. Writes the choices and reasons to
//     out/reel-takes.md. The hook is the strongest of 01, 01b and 01c; the others become
//     alternate cuts.
//  4. Trims dead air (before, after and inside a take), cleans the voice (high-pass, gentle
//     compression), cuts each take to 1080x1920 30 fps.
//  5. Lays out the edit per the script's structure (B-roll from the app captures in
//     public/capture/v3, punch-ins on emphasis words, finding labels), writes the sound stem
//     (sfx hits on the findings and the verdict), renders 9:16 and 4:5, masters to -14 LUFS,
//     and saves a cover frame.
//
// Outputs (out/): reel_9x16.mp4, reel_4x5.mp4, reel_alt_hook_b.mp4, reel_alt_hook_c.mp4,
// reel_cover.png, reel-takes.md.
// Usage: npm run reel [-- --model small.en] [--no-render]

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Broll, Plan, Visual, Voice, Word } from "../src/reel/Reel";
import { ffmpeg, master, OUT, PUBLIC, render, still, VIDEO } from "./lib";

const RAW = join(VIDEO, "footage", "raw");
const WORK = join(VIDEO, ".cache", "reel-v3");
const PUB = join(PUBLIC, "reel-v3");
const WHISPER = join(VIDEO, "whisper.cpp");
const WHISPER_VERSION = "1.5.5";
const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const MODEL = arg("model", process.env.WHISPER_MODEL ?? "small.en");
const MEDIA = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts"]);
const FILLERS = new Set(["um", "uh", "erm", "er", "ah", "hmm", "mm", "uhm"]);

type ScriptShot = { line: string | null; emphasis?: string[]; alt?: string };
type Script = { target: { min: number; max: number }; shots: Record<string, ScriptShot>; structure: Record<string, unknown>[] };
type W = { text: string; start: number; end: number; p: number; take?: number };
type Take = { shot: string; file: string; index: number; start: number; end: number; words: W[]; score: number; why: string };

// ---------------------------------------------------------------- 0. footage

if (!existsSync(RAW) || !readdirSync(RAW).some((f) => MEDIA.has(extname(f).toLowerCase()))) {
  console.error("no footage in video/footage/raw");
  console.error("Drop the raw clips there, named by shot (01_hook.mov, 02_readme.mp4, ...), then run npm run reel again.");
  process.exit(1);
}
const script: Script = JSON.parse(readFileSync(join(VIDEO, "reel", "script.json"), "utf8"));
const shotOf = (f: string) => Object.keys(script.shots).find((s) => f.toLowerCase().startsWith(s));
const clips = readdirSync(RAW)
  .filter((f) => MEDIA.has(extname(f).toLowerCase()))
  .map((f) => ({ file: join(RAW, f), shot: shotOf(f) }))
  .filter((c): c is { file: string; shot: string } => !!c.shot);
console.log(`footage: ${clips.map((c) => c.shot).join(", ")}`);
rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });
mkdirSync(WORK, { recursive: true });

// ---------------------------------------------------------------- 1. transcription

const tokens = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9.' ]+/g, " ").replace(/\.(?!\w)/g, " ").split(/\s+/).filter(Boolean);
const duration = (f: string) => Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(ffprobeText(f))!.slice(1).reduce((a, x, i) => a + Number(x) * [3600, 60, 1][i], 0));
function ffprobeText(f: string) {
  try {
    ffmpeg(["-i", f]);
    return "";
  } catch (e) {
    return String(e);
  }
}

/** whisper.cpp tokens to words: a token without a leading space continues the word before it, bare punctuation sticks to it, DTW times. */
function tokensToWords(captions: { text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null }[]): W[] {
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

async function transcribeAll(): Promise<Map<string, W[]>> {
  const w = await import("@remotion/install-whisper-cpp");
  await w.installWhisperCpp({ to: WHISPER, version: WHISPER_VERSION, printOutput: false });
  await w.downloadWhisperModel({ model: MODEL as "small.en", folder: WHISPER, printOutput: false });
  const out = new Map<string, W[]>();
  for (const c of clips) {
    const wav = join(WORK, `${c.shot}.16k.wav`);
    ffmpeg(["-i", c.file, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
    if (script.shots[c.shot].line === null && !c.shot.startsWith("04")) {
      out.set(c.file, []);
      continue;
    }
    // Takes first (split on silence), then each take transcribed on its own, so every word
    // belongs to its take. Cached per take (file size and time, bounds, model).
    const st = statSync(c.file);
    const words: W[] = [];
    for (const [ti, [ta, tb]] of speech(c.file).entries()) {
      const cacheFile = join(WORK, `${c.shot}.${st.size}.${Math.round(st.mtimeMs)}.${ta.toFixed(2)}-${tb.toFixed(2)}.${MODEL}.json`);
      let captions: { text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null }[];
      if (existsSync(cacheFile)) captions = JSON.parse(readFileSync(cacheFile, "utf8"));
      else {
        const part = join(WORK, `${c.shot}.take.wav`);
        ffmpeg(["-i", wav, "-af", `atrim=${ta}:${tb},asetpts=PTS-STARTPTS,apad=pad_dur=0.5`, "-c:a", "pcm_s16le", part]);
        const res = await w.transcribe({ inputPath: part, whisperPath: WHISPER, whisperCppVersion: WHISPER_VERSION, model: MODEL as "small.en", tokenLevelTimestamps: true, printOutput: false });
        captions = w.toCaptions({ whisperCppOutput: res }).captions;
        writeFileSync(cacheFile, JSON.stringify(captions));
      }
      const tw = tokensToWords(captions).map((x) => ({ ...x, start: Math.min(tb, ta + x.start), end: Math.min(tb, ta + x.end), take: ti }));
      words.push(...tw);
    }
    console.log(`  ${c.shot}: ${words.map((x) => x.text).join(" ").slice(0, 90)}`);
    out.set(c.file, words);
  }
  return out;
}

// ---------------------------------------------------------------- 2. takes

/** Takes: the speech between silences of 1.2 s or more (the shoot leaves about 2 s between takes; pauses inside a line are shorter). */
function speech(file: string): [number, number][] {
  const wav = join(WORK, `${clips.find((c) => c.file === file)!.shot}.16k.wav`);
  let log = "";
  try {
    log = ffmpeg(["-i", wav, "-af", "silencedetect=noise=-32dB:d=1.2", "-f", "null", "-"]);
  } catch (e) {
    log = String(e);
  }
  const total = duration(wav);
  // A take is the speech between two silences, padded 0.35 s each side (never past the
  // middle of the silence) so a word whisper places on the edge stays with its take.
  const silences: [number, number][] = [];
  let open: number | null = null;
  for (const m of log.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === "start") open = Number(m[2]);
    else if (open !== null) silences.push([open, Number(m[2])]), (open = null);
  }
  if (open !== null) silences.push([open, total]);
  const segs: [number, number][] = [];
  const edges = [[0, 0] as [number, number], ...silences, [total, total] as [number, number]];
  for (let i = 0; i + 1 < edges.length; i++) {
    const [pa, pb] = edges[i];
    const [na, nb] = edges[i + 1];
    if (na - pb <= 0.35) continue;
    segs.push([Math.max((pa + pb) / 2, pb - 0.35), Math.min((na + nb) / 2, na + 0.35)]);
  }
  return segs;
}

function lev(a: string[], b: string[]) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function takesFor(c: { file: string; shot: string }, words: W[]): Take[] {
  const line = script.shots[c.shot].line;
  if (line === null && !c.shot.startsWith("04")) {
    // No dialogue: even slices across the clip, skipping the first and last half second.
    const d = duration(c.file);
    const n = Math.max(1, Math.floor((d - 1) / 1.2));
    return Array.from({ length: n }, (_, i) => ({ shot: c.shot, file: c.file, index: i, start: 0.5 + i * 1.2, end: 0.5 + i * 1.2 + 1.1, words: [], score: 0, why: "slice" }));
  }
  const ref = line ? tokens(line) : [];
  return speech(c.file)
    .map(([a, b], index) => {
      const ws = words.filter((w) => w.take === index);
      const said = ws.flatMap((w) => tokens(w.text));
      const fillers = said.filter((x) => FILLERS.has(x)).length;
      const clean = said.filter((x) => !FILLERS.has(x));
      const sim = ref.length ? 1 - lev(clean, ref) / Math.max(ref.length, clean.length, 1) : Math.min(1, clean.length / 25);
      const stalls = ws.slice(1).reduce((s, w, i) => s + Math.max(0, w.start - ws[i].end - 0.5), 0);
      const conf = ws.length ? ws.reduce((s, w) => s + w.p, 0) / ws.length : 0;
      const score = sim * 100 - fillers * 8 - stalls * 10 + conf * 10 + index * 0.5;
      const why = `${Math.round(sim * 100)}% match, ${fillers} filler${fillers === 1 ? "" : "s"}, ${stalls.toFixed(1)}s of stalls, confidence ${conf.toFixed(2)}`;
      return { shot: c.shot, file: c.file, index, start: a, end: b, words: ws, score, why };
    })
    .filter((t) => t.words.length > 0);
}

// ---------------------------------------------------------------- 3. cutting

let cutN = 0;
/** Cuts a take tight: lead-in and tail trimmed, pauses inside over 0.5 s shortened. Returns the clip and its words, retimed. */
function cut(t: Take): { src: string; dur: number; words: W[] } {
  const parts: [number, number][] = [];
  if (!t.words.length) parts.push([t.start, t.end]);
  else {
    let a = Math.max(0, t.words[0].start - 0.12);
    for (let i = 1; i < t.words.length; i++) {
      if (t.words[i].start - t.words[i - 1].end > 0.5) {
        parts.push([a, t.words[i - 1].end + 0.12]);
        a = t.words[i].start - 0.1;
      }
    }
    parts.push([a, t.words.at(-1)!.end + 0.22]);
  }
  const name = `take-${++cutN}-${t.shot}.mp4`;
  const filter = parts.map(([a, b], i) => `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS[a${i}];`).join("");
  const cat = parts.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${parts.length}:v=1:a=1[v][a]`;
  ffmpeg([
    "-i", t.file, "-filter_complex",
    `${filter}${cat};[v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p[vo];[a]highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=3,aresample=48000[ao]`,
    "-map", "[vo]", "-map", "[ao]", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-c:a", "aac", "-b:a", "256k", "-ac", "2", "-movflags", "+faststart", join(PUB, name),
  ]);
  // Retime words onto the cut.
  let acc = 0;
  const words: W[] = [];
  for (const [a, b] of parts) {
    for (const w of t.words) if (w.start >= a - 0.01 && w.end <= b + 0.01) words.push({ ...w, start: w.start - a + acc, end: w.end - a + acc });
    acc += b - a;
  }
  return { src: `reel-v3/${name}`, dur: acc, words };
}

// ---------------------------------------------------------------- 4. the edit

type Beat = Record<string, unknown> & { beat: string };
const emph = (shot: string) => new Set((script.shots[shot]?.emphasis ?? []).flatMap(tokens));

type Hit = { t: number; kind: string };
function plan(best: Map<string, Take>, reactions: Take[], hook: string): { p: Plan; hits: Hit[] } {
  const visuals: Visual[] = [];
  const voice: Voice[] = [];
  const words: Word[] = [];
  const hits: Hit[] = [];
  let t = 0;
  const say = (shot: string) => {
    const take = best.get(shot);
    if (!take) return null;
    const c = cut(take);
    const e = emph(shot);
    voice.push({ src: c.src, start: t, dur: c.dur });
    for (const w of c.words) words.push({ text: w.text, start: t + w.start, end: t + w.end, emph: tokens(w.text).some((x) => e.has(x)) });
    return c;
  };
  for (const b of script.structure as Beat[]) {
    if (b.beat === "hook") {
      const c = say(hook);
      if (c) visuals.push({ kind: "face", src: c.src, start: t, dur: c.dur }), (t += c.dur);
    } else if (b.beat === "findings") {
      const fs = b.findings as { label: string; broll: never; dur: number }[];
      fs.forEach((f, i) => {
        visuals.push({ kind: "broll", start: t, dur: f.dur, broll: f.broll, label: f.label });
        hits.push({ t: t + 0.1, kind: "finding" });
        t += f.dur;
        const r = reactions[Math.round((i * (reactions.length - 1)) / Math.max(1, fs.length - 1))];
        if (r) {
          const c = cut(r);
          const d = Math.min(c.dur, b.reactionDur as number);
          visuals.push({ kind: "face", src: c.src, start: t, dur: d });
          t += d;
        }
      });
    } else if (b.beat === "answer") {
      const c = say(b.shot as string);
      if (c) visuals.push({ kind: "split", start: t, dur: c.dur, broll: b.split as never, face: { src: c.src, offset: 0 } }), (t += c.dur);
    } else if (b.beat === "verdict") {
      const c = say(b.shot as string);
      if (c) visuals.push({ kind: "face", src: c.src, start: t, dur: c.dur }), (t += c.dur);
      const after = b.after as Broll & { dur: number };
      visuals.push({ kind: "broll", start: t, dur: after.dur, broll: after });
      hits.push({ t: t + 0.05, kind: "verdict" });
      t += after.dur;
    } else if (b.beat === "cta") {
      const c = say(b.shot as string);
      const d = (c?.dur ?? 2) + 0.6;
      visuals.push({ kind: "card", start: t, dur: d, pip: c ? { src: c.src, offset: 0 } : undefined });
      hits.push({ t, kind: "end" });
      t += d;
    } else {
      // readme, fixlist: the line over its capture, the face in a corner for the fix list.
      const c = say(b.shot as string);
      if (!c) continue;
      visuals.push({ kind: "broll", start: t, dur: c.dur, broll: b.broll as never, pip: b.pip ? { src: c.src, offset: 0 } : undefined });
      t += c.dur;
    }
  }
  return { p: { duration: t, voice, visuals, words, sfx: null }, hits };
}

// ---------------------------------------------------------------- run

const transcripts = await transcribeAll();
const best = new Map<string, Take>();
let report = `# Reel takes\n\nModel: whisper.cpp ${WHISPER_VERSION}, ${MODEL}. Score: script match x100, minus 8 per filler, minus 10 per second of stalls, plus confidence x10, plus 0.5 per later take (a tie goes to the later, warmer take). Eye line can't be measured without a vision model, so it isn't scored: check the picks below.\n\n`;
let reactions: Take[] = [];
for (const c of clips) {
  const takes = takesFor(c, transcripts.get(c.file) ?? []);
  if (script.shots[c.shot].line === null && !c.shot.startsWith("04")) {
    if (c.shot.startsWith("03")) reactions = takes;
    report += `## ${c.shot}\n\n${takes.length} reaction slices of 1.1 s (no dialogue).\n\n`;
    continue;
  }
  takes.sort((a, b) => b.score - a.score);
  report += `## ${c.shot}\n\nScript: ${script.shots[c.shot].line ?? "(free answer)"}\n\n| Take | At | Heard | Score | Why |\n|---|---|---|---|---|\n`;
  for (const t of takes) report += `| ${t.index + 1}${t === takes[0] ? " (picked)" : ""} | ${t.start.toFixed(1)}-${t.end.toFixed(1)} s | ${t.words.map((w) => w.text).join(" ")} | ${t.score.toFixed(1)} | ${t.why} |\n`;
  report += "\n";
  if (takes[0]) best.set(c.shot, takes[0]);
}
const hooks = ["01_hook", "01b_hook", "01c_hook"].filter((h) => best.has(h)).sort((a, b) => best.get(b)!.score - best.get(a)!.score);
if (!hooks.length) {
  console.error("no usable hook take: record 01_hook (or 01b_hook / 01c_hook)");
  process.exit(1);
}
report += `## Hook\n\nStrongest: **${hooks[0]}** (${hooks.map((h) => `${h} ${best.get(h)!.score.toFixed(1)}`).join(", ")}).\n`;
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "reel-takes.md"), report);

const plans: [string, Plan, Hit[]][] = [];
for (const [i, h] of hooks.entries()) {
  const { p, hits } = plan(best, reactions, h);
  plans.push([i === 0 ? "reel" : `reel_alt_hook_${h[2] === "_" ? "a" : h[2]}`, p, hits]);
}

// Sound: a hit per finding, the verdict, the end card (sfx/cues/reel.py reads hits.json).
for (const [name, p, hits] of plans) {
  writeFileSync(join(PUB, "hits.json"), JSON.stringify({ duration: p.duration, hits }));
  const r = spawnSync("python", ["-m", "sfx.cues.reel", join(PUB, "hits.json"), join(PUB, `${name}-sfx.wav`)], { cwd: VIDEO, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  p.sfx = `reel-v3/${name}-sfx.wav`;
  const secs = p.duration.toFixed(1);
  console.log(`${name}: ${secs}s ${p.duration < script.target.min || p.duration > script.target.max ? `(target ${script.target.min}-${script.target.max}s)` : ""}`);
}

if (process.argv.includes("--no-render")) process.exit(0);
const files: string[] = [];
for (const [name, p] of plans) {
  const outs: [string, string][] = name === "reel" ? [["reel-9x16", "reel_9x16"], ["reel-4x5", "reel_4x5"]] : [["reel-9x16", name]];
  for (const [id, file] of outs) {
    const raw = join(WORK, `${file}.raw.mp4`);
    await render(id, raw, { plan: p });
    const r = master(raw, join(OUT, `${file}.mp4`), -14);
    console.log(`  ${file}.mp4  ${Number(r.after.input_i).toFixed(1)} LUFS`);
    files.push(`${file}.mp4`);
  }
  if (name === "reel") {
    // Cover: the first finding, label up, mid-shot.
    const f = p.visuals.find((v) => v.kind === "broll" && "label" in v && v.label);
    await still("reel-9x16", join(OUT, "reel_cover.png"), Math.round(((f?.start ?? 0) + 0.9) * 30), { plan: p });
  }
}
console.log(`done: ${files.join(", ")}, reel_cover.png, reel-takes.md in video/out`);
