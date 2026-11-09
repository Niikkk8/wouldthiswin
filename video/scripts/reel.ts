// The face reel, from raw phone footage to finished files.
//
//  1. Pulls the audio out of every file in the footage folder (16kHz mono).
//  2. Transcribes it locally with faster-whisper (scripts/transcribe.py), word timestamps on.
//  3. Finds every take of every script line (src/reel-script.ts) by aligning the transcript
//     to the script, word by word, and scores each take.
//  4. Picks the cleanest take per line: closest to the script, no fillers, no long stalls,
//     confident words; ties go to the later take.
//  5. Cuts it tight (silence before and after trimmed, long pauses inside shortened),
//     frames it 1080x1920 at 30fps, applies a light grade, levels the voice.
//  6. Writes public/reel/takes.json and renders the ReelFace composition, then masters:
//       reel-face-9x16.mp4            voice only, -14 LUFS
//       reel-face-9x16-ig.mp4         voice only (Instagram)
//       reel-face-9x16-linkedin.mp4   voice + quiet music (music.mp3 if present)
//
// Usage: npm run reel [-- --footage <dir>] [--out <dir>] [--suffix <name>] [--no-render]
// Re-running reuses the transcript cache when the footage hasn't changed.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { REEL_SCRIPT, type ReelLine } from "../src/reel-script";
import type { ReelLineTake, ReelTakes, ReelWord } from "../src/ReelFace";
import { CACHE, ensureCaptures, ffmpeg, master, OUT, preparePublic, probe, PUBLIC, render, run, VIDEO } from "./lib";
import { plan } from "./plan";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const FOOTAGE = arg("footage", join(VIDEO, "footage"));
const OUTDIR = arg("out", OUT);
const SUFFIX = arg("suffix", "");
const DO_RENDER = !process.argv.includes("--no-render");
const WORK = join(CACHE, "reel");
const REEL_PUBLIC = join(PUBLIC, "reel");
const PY = join(VIDEO, ".venv", "Scripts", "python.exe");

type Word = { start: number; end: number; word: string; p: number; file: string };

// ---------------------------------------------------------------------------- text

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function numberWords(n: number): string[] {
  if (n < 20) return [ONES[n]];
  if (n < 100) return n % 10 ? [TENS[Math.floor(n / 10)], ONES[n % 10]] : [TENS[n / 10]];
  return String(n).split("").map((d) => ONES[Number(d)]);
}

/** Lowercase words without punctuation; numbers and "$25" spelled out, so "30" matches "thirty". */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\$(\d+)/g, "$1 dollars")
    .replace(/[-–—/]/g, " ")
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (/^\d+$/.test(w) ? numberWords(Number(w)) : [w.replace(/^'+|'+$/g, "")]))
    .filter(Boolean);
}

const FILLERS = new Set(["um", "uh", "erm", "er", "hmm", "mm", "uhm", "ah"]);

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}
/** 1 for the same word, near 1 for a near miss ("akshat" / "akshit"), 0 for unrelated. */
function sim(a: string, b: string): number {
  if (a === b) return 1;
  const s = 1 - lev(a, b) / Math.max(a.length, b.length);
  return s >= 0.5 ? s : 0;
}

// ---------------------------------------------------------------------------- alignment

type Alignment = { cost: number; end: number; map: (number | null)[] };

/**
 * Aligns all of `script` to a stretch of `heard` starting at `start` (its end is free).
 * Substitution costs 1 - similarity, a missing or extra word costs 1. Returns the cheapest
 * end, and for each script token the heard index it matched (or null).
 */
function align(script: string[], heard: string[], start: number, maxEnd: number): Alignment {
  const n = script.length;
  const m = Math.min(heard.length, maxEnd) - start;
  const D: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) D[i][0] = i;
  for (let j = 1; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const h = heard[start + j - 1];
      const extra = FILLERS.has(h) ? 0.35 : 1; // a filler costs less than a wrong word, but still costs
      D[i][j] = Math.min(D[i - 1][j - 1] + (1 - sim(script[i - 1], h)), D[i - 1][j] + 1, D[i][j - 1] + extra);
    }
  let end = 0;
  for (let j = 1; j <= m; j++) if (D[n][j] < D[n][end] - 1e-9) end = j;
  const map: (number | null)[] = new Array(n).fill(null);
  let i = n;
  let j = end;
  while (i > 0 && j > 0) {
    const h = heard[start + j - 1];
    const extra = FILLERS.has(h) ? 0.35 : 1;
    if (Math.abs(D[i][j] - (D[i - 1][j - 1] + (1 - sim(script[i - 1], h)))) < 1e-9) {
      if (sim(script[i - 1], h) > 0) map[i - 1] = start + j - 1;
      i--;
      j--;
    } else if (Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9) i--;
    else if (Math.abs(D[i][j] - (D[i][j - 1] + extra)) < 1e-9) j--;
    else i--;
  }
  return { cost: D[n][end], end: start + end, map };
}

export type Take = {
  line: number;
  file: string;
  /** Heard word indexes [from, to). */
  from: number;
  to: number;
  match: number;
  fillers: number;
  stall: number;
  confidence: number;
  quality: number;
  map: (number | null)[];
};

/** Every take of every line in the transcript, best-matching first, never overlapping. */
export function findTakes(words: Word[], script: ReelLine[]): Take[] {
  // Aligned token by token: a heard word like "$25" is three tokens ("twenty five dollars"),
  // each pointing back at the word it came from.
  const heard: string[] = [];
  const owner: number[] = [];
  words.forEach((w, i) => {
    const t = tokens(w.word);
    for (const x of t.length ? t : [w.word.toLowerCase()]) {
      heard.push(x);
      owner.push(i);
    }
  });
  // A gap this long, or a change of file, is a break between takes: no take spans one.
  const wordBreak = words.map((w, i) => i === words.length - 1 || words[i + 1].file !== w.file || words[i + 1].start - w.end > 2.2);
  const breakAfter = heard.map((_, k) => k === heard.length - 1 || (owner[k + 1] !== owner[k] && wordBreak[owner[k]]));
  const candidates: Take[] = [];
  for (const line of script) {
    const want = tokens(line.text);
    for (let s = 0; s < heard.length; s++) {
      // Starts on a word boundary, on (nearly) the line's first or second word.
      if (s > 0 && owner[s] === owner[s - 1]) continue;
      if (sim(heard[s], want[0]) < 0.6 && !(want[1] && sim(heard[s], want[1]) >= 0.7)) continue;
      let maxEnd = s;
      while (maxEnd < heard.length && maxEnd - s < want.length + 8) {
        maxEnd++;
        if (breakAfter[maxEnd - 1]) break;
      }
      const a = align(want, heard, s, maxEnd);
      const match = 1 - a.cost / want.length;
      if (match < 0.6 || a.end <= s) continue;
      const from = owner[s];
      const to = owner[a.end - 1] + 1;
      const span = words.slice(from, to);
      const fillers = span.filter((w) => FILLERS.has(tokens(w.word)[0] ?? "")).length;
      let stall = 0;
      for (let k = 1; k < span.length; k++) stall = Math.max(stall, span[k].start - span[k - 1].end);
      const confidence = span.reduce((x, w) => x + w.p, 0) / span.length;
      // Line 7's pause before "tired" is the joke; only stalls past it count against a take.
      const stallLimit = line.id === 7 ? 1.6 : 0.9;
      const quality = match - 0.1 * fillers - (stall > stallLimit ? 0.12 : 0) + 0.05 * confidence;
      const map = a.map.map((k) => (k === null ? null : owner[k]));
      candidates.push({ line: line.id, file: words[from].file, from, to, match, fillers, stall, confidence, quality, map });
    }
  }
  // Best first; a word belongs to one take only.
  candidates.sort((a, b) => b.match - a.match || b.quality - a.quality);
  const used = new Set<number>();
  const takes: Take[] = [];
  for (const c of candidates) {
    let free = true;
    for (let k = c.from; k < c.to; k++) if (used.has(k)) free = false;
    if (!free) continue;
    for (let k = c.from; k < c.to; k++) used.add(k);
    takes.push(c);
  }
  return takes.sort((a, b) => a.from - b.from);
}

/** The cleanest take for each line. Later takes win ties (people warm up). */
export function pick(takes: Take[], script: ReelLine[]): Map<number, { take: Take; of: number }> {
  const out = new Map<number, { take: Take; of: number }>();
  for (const line of script) {
    const mine = takes.filter((t) => t.line === line.id);
    if (!mine.length) continue;
    const best = mine.reduce((a, b) => (b.quality >= a.quality - 0.02 ? (b.quality > a.quality + 0.02 || b.from > a.from ? b : a) : a));
    out.set(line.id, { take: best, of: mine.length });
  }
  return out;
}

// ---------------------------------------------------------------------------- cutting

type Segment = { from: number; to: number };

/**
 * The cut for a take: from just before the first word to just after the last, with long
 * pauses inside shortened. Returns the segments (source seconds) and the script's words
 * timed on the cut's own clock.
 */
export function cut(take: Take, words: Word[], line: ReelLine): { segments: Segment[]; words: ReelWord[]; duration: number } {
  const span = words.slice(take.from, take.to).filter((w) => !FILLERS.has(tokens(w.word)[0] ?? ""));
  const prevEnd = take.from > 0 && words[take.from - 1].file === words[take.from].file ? words[take.from - 1].end : 0;
  const next = words[take.to];
  const nextStart = next && next.file === words[take.from].file ? next.start : Infinity;
  const start = Math.max(prevEnd + 0.05, span[0].start - 0.14);
  const end = Math.min(nextStart - 0.05, span.at(-1)!.end + 0.24);
  const maxGap = line.id === 7 ? 0.95 : 0.55;
  const segments: Segment[] = [];
  let segStart = start;
  for (let k = 1; k < span.length; k++) {
    const gap = span[k].start - span[k - 1].end;
    if (gap > maxGap + 0.1) {
      segments.push({ from: segStart, to: span[k - 1].end + maxGap / 2 });
      segStart = span[k].start - maxGap / 2;
    }
  }
  segments.push({ from: segStart, to: end });
  const toCut = (t: number) => {
    let acc = 0;
    for (const s of segments) {
      if (t < s.from) return acc;
      if (t <= s.to) return acc + (t - s.from);
      acc += s.to - s.from;
    }
    return acc;
  };
  const duration = segments.reduce((x, s) => x + s.to - s.from, 0);

  // The script's own words (spelling and punctuation as written), timed from the take.
  const display = line.text.split(/\s+/);
  const timed: ReelWord[] = [];
  let k = 0;
  for (const d of display) {
    const n = tokens(d).length;
    const idx = take.map.slice(k, k + n).filter((x): x is number => x !== null);
    k += n;
    timed.push(idx.length ? { text: d, start: toCut(words[idx[0]].start), end: toCut(words[idx.at(-1)!].end) } : { text: d, start: NaN, end: NaN });
  }
  // Words the transcript missed: spread them between their neighbours.
  for (let i = 0; i < timed.length; i++) {
    if (!Number.isNaN(timed[i].start)) continue;
    let j = i;
    while (j < timed.length && Number.isNaN(timed[j].start)) j++;
    const a = i > 0 ? timed[i - 1].end : toCut(span[0].start);
    const b = j < timed.length ? timed[j].start : toCut(span.at(-1)!.end);
    const step = (b - a) / (j - i + 1);
    for (let q = i; q < j; q++) timed[q] = { text: timed[q].text, start: a + step * (q - i + 0.5), end: a + step * (q - i + 1) };
  }
  return { segments, words: timed, duration };
}

// ---------------------------------------------------------------------------- media

/** The grade and framing: 1080x1920 cover, 30fps, a light lift; HDR phone footage tone-mapped to SDR. */
function videoChain(file: string): string {
  const v = probe(file).streams.find((s) => s.codec_type === "video")!;
  const hdr = v.color_transfer === "arib-std-b67" || v.color_transfer === "smpte2084";
  const tonemap = hdr ? "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv," : "";
  return `${tonemap}scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1,fps=30,eq=contrast=1.04:saturation=1.07:gamma=1.02,unsharp=5:5:0.25,format=yuv420p`;
}

function encodeLine(file: string, segments: Segment[], output: string) {
  const parts: string[] = [];
  segments.forEach((s, i) => {
    const d = s.to - s.from;
    parts.push(`[0:v]trim=start=${s.from.toFixed(3)}:end=${s.to.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${s.from.toFixed(3)}:end=${s.to.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.025,afade=t=out:st=${Math.max(0, d - 0.04).toFixed(3)}:d=0.04[a${i}]`);
  });
  parts.push(`${segments.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${segments.length}:v=1:a=1[vc][ac]`);
  parts.push(`[vc]${videoChain(file)}[v]`);
  // The voice: rumble off, gentle de-noise, levelled (the final master sets -14 LUFS).
  parts.push(`[ac]highpass=f=75,afftdn=nr=8:nf=-45,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000[a]`);
  ffmpeg(["-i", file, "-filter_complex", parts.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-c:a", "aac", "-b:a", "256k", "-ac", "2", "-movflags", "+faststart", output]);
}

// ---------------------------------------------------------------------------- main

async function main() {
  const files = existsSync(FOOTAGE)
    ? readdirSync(FOOTAGE)
        .filter((f) => /\.(mp4|mov|m4v|mkv|webm)$/i.test(f))
        .sort()
        .map((f) => join(FOOTAGE, f))
    : [];
  if (!files.length) throw new Error(`no footage in ${FOOTAGE}`);
  console.log(`footage: ${files.length} file(s) in ${FOOTAGE}`);
  mkdirSync(WORK, { recursive: true });

  // 1-2. Audio out, transcript in (cached on the footage's names, sizes and times).
  const key = createHash("sha1").update(files.map((f) => `${f}:${statSync(f).size}:${statSync(f).mtimeMs}`).join("|") + (process.env.WHISPER_MODEL ?? "") + readFileSync(join(VIDEO, "scripts", "transcribe.py"), "utf8")).digest("hex").slice(0, 12);
  const wordsFile = join(WORK, `words-${key}.json`);
  if (!existsSync(wordsFile)) {
    const wavs = files.map((f) => {
      const wav = join(WORK, `${basename(f, extname(f))}-${key}.wav`);
      ffmpeg(["-i", f, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
      return wav;
    });
    console.log(`transcribing locally (faster-whisper ${process.env.WHISPER_MODEL ?? "small.en"})...`);
    run(PY, [join(VIDEO, "scripts", "transcribe.py"), wordsFile, ...wavs], { quiet: false });
    for (const w of wavs) rmSync(w);
  } else console.log("transcript: cached");
  const byWav: Record<string, Omit<Word, "file">[]> = JSON.parse(readFileSync(wordsFile, "utf8"));
  const words: Word[] = Object.values(byWav).flatMap((ws, i) => ws.map((w) => ({ ...w, file: files[i] })));

  // 3-4. Takes, and the pick.
  const takes = findTakes(words, REEL_SCRIPT);
  const picks = pick(takes, REEL_SCRIPT);
  const missing = REEL_SCRIPT.filter((l) => !picks.has(l.id));
  if (missing.length) throw new Error(`no usable take for line(s) ${missing.map((l) => l.id).join(", ")}: re-record or check footage`);

  // 5. Cut and encode each line.
  rmSync(REEL_PUBLIC, { recursive: true, force: true });
  mkdirSync(REEL_PUBLIC, { recursive: true });
  const lines: ReelLineTake[] = [];
  const report: string[] = [];
  for (const line of REEL_SCRIPT) {
    const { take, of } = picks.get(line.id)!;
    const c = cut(take, words, line);
    const name = `line-${line.id}.mp4`;
    encodeLine(take.file, c.segments, join(REEL_PUBLIC, name));
    const real = Number(probe(join(REEL_PUBLIC, name)).format.duration);
    lines.push({ id: line.id, layout: line.layout, text: line.text, src: `reel/${name}`, duration: Math.round(real * 30) / 30, words: c.words });
    const heard = words.slice(take.from, take.to).map((w) => w.word).join(" ");
    const t0 = words[take.from].start;
    report.push(
      `line ${line.id}: take ${takes.filter((t) => t.line === line.id).indexOf(take) + 1} of ${of} (${basename(take.file)} @ ${t0.toFixed(1)}s), match ${(take.match * 100).toFixed(0)}%, fillers ${take.fillers}, longest pause ${take.stall.toFixed(2)}s, ${real.toFixed(2)}s after cutting\n    heard: ${heard}`,
    );
  }
  const out: ReelTakes = { lines };
  writeFileSync(join(REEL_PUBLIC, "takes.json"), JSON.stringify(out, null, 1));
  const total = lines.reduce((x, l) => x + l.duration, 0);
  const summary = `${report.join("\n")}\n\ntotal: ${total.toFixed(1)}s`;
  writeFileSync(join(WORK, `report${SUFFIX}.txt`), summary);
  console.log(summary);

  if (!DO_RENDER) return;

  // 6. Render and master.
  await ensureCaptures(); // lines 6 and 8 show the captured product
  const { music } = await preparePublic();
  const demo = plan("9x16");
  mkdirSync(OUTDIR, { recursive: true });
  const tmp = join(CACHE, "render");
  mkdirSync(tmp, { recursive: true });
  // Without music the LinkedIn cut is the same file: rendered once, copied below.
  const versions = [{ file: `reel-face-9x16${SUFFIX}.mp4`, music: false }];
  if (music) versions.push({ file: `reel-face-9x16-linkedin${SUFFIX}.mp4`, music: true });
  for (const v of versions) {
    process.stdout.write(`render ${v.file}:`);
    const raw = join(tmp, v.file);
    await render("reel-face-9x16", raw, { takes: out, music: v.music, demo });
    const loud = master(raw, join(OUTDIR, v.file));
    rmSync(raw);
    console.log(`  ${v.file}: ${loud.after.input_i} LUFS, ${loud.after.input_tp} dBTP`);
  }
  // Instagram's cut is the voice-only master.
  copyFileSync(join(OUTDIR, `reel-face-9x16${SUFFIX}.mp4`), join(OUTDIR, `reel-face-9x16-ig${SUFFIX}.mp4`));
  if (!music) {
    copyFileSync(join(OUTDIR, `reel-face-9x16${SUFFIX}.mp4`), join(OUTDIR, `reel-face-9x16-linkedin${SUFFIX}.mp4`));
    console.log("music: none yet (video/audio/music.mp3 missing): the LinkedIn cut is voice only for now");
  }
}

if (process.argv[1]?.endsWith("reel.ts")) await main();
