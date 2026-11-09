// Shared by the render, reel and check scripts: ffmpeg/ffprobe, loudness, Remotion.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
export const FFMPEG: string = require("ffmpeg-static");
export const FFPROBE: string = require("ffprobe-static").path;

export const VIDEO = join(import.meta.dirname, "..");
export const REPO = join(VIDEO, "..");
export const PUBLIC = join(VIDEO, "public");
export const OUT = join(VIDEO, "out");
export const CACHE = join(VIDEO, ".cache");

/** Runs a command, returns stdout+stderr; throws with the tail of the output on failure. */
export function run(cmd: string, args: string[], { quiet = true } = {}): string {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  if (r.status !== 0) throw new Error(`${cmd.split(/[\\/]/).pop()} failed (${r.status}):\n${out.slice(-3000)}`);
  if (!quiet) process.stdout.write(out);
  return out;
}

export const ffmpeg = (args: string[]) => run(FFMPEG, ["-hide_banner", "-y", ...args]);

export type Probe = {
  format: { duration: string; size: string; bit_rate: string; format_name: string };
  streams: {
    codec_type: string;
    codec_name: string;
    profile?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    avg_frame_rate?: string;
    pix_fmt?: string;
    sample_rate?: string;
    channels?: number;
    bit_rate?: string;
    color_transfer?: string;
    color_primaries?: string;
    side_data_list?: { rotation?: number }[];
  }[];
};
export const probe = (file: string): Probe => JSON.parse(run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));

export type Loudness = { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string };

/** Measures integrated loudness (EBU R128) of a file's audio. */
export function measure(file: string, target = -14, tp = -1): Loudness {
  const out = ffmpeg(["-i", file, "-vn", "-af", `loudnorm=I=${target}:TP=${tp}:LRA=11:print_format=json`, "-f", "null", "-"]);
  const json = out.slice(out.lastIndexOf("{"), out.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

/**
 * Masters a render to -14 LUFS integrated, -1 dBTP: two-pass loudnorm (linear when the
 * headroom allows), the picture copied untouched. Returns the measured result.
 */
export function master(input: string, output: string, target = -14): { before: Loudness; after: Loudness } {
  const m = measure(input, target);
  // Sparse, peaky audio (clicks, a thud) can't reach -14 by gain alone without passing -1 dBTP.
  // So: gain, then a true-peak-aware limiter (oversampled), measured and corrected until the
  // integrated loudness lands within 0.3 LU of the target. The picture is copied untouched.
  const staged = output.replace(/\.mp4$/, ".staged.wav");
  let gain = target - Number(m.input_i);
  for (let pass = 0; pass < 5; pass++) {
    const af = `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=0.74:level=false:attack=1:release=80:asc=1,aresample=48000`;
    ffmpeg(["-i", input, "-vn", "-af", af, "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2", staged]);
    const s = measure(staged, target);
    const miss = target - Number(s.input_i);
    if (Math.abs(miss) <= 0.3) break;
    gain += miss;
  }
  ffmpeg(["-i", input, "-i", staged, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", output]);
  rmSync(staged);
  return { before: m, after: measure(output, target) };
}

/** The things every render needs in public/: the judges' sheets, the logo, the sounds, the music if any. */
export async function preparePublic(): Promise<{ music: boolean }> {
  mkdirSync(join(PUBLIC, "judges"), { recursive: true });
  for (const j of ["engineer", "investor", "tired"]) copyFileSync(join(REPO, "public", "judges", `${j}-sheet.png`), join(PUBLIC, "judges", `${j}-sheet.png`));
  copyFileSync(join(REPO, "public", "logo.png"), join(PUBLIC, "logo.png"));
  if (!existsSync(join(PUBLIC, "sfx", "chime.wav"))) run(process.execPath, ["--import", "tsx", join(VIDEO, "scripts", "sfx.ts")]);
  const music = join(VIDEO, "audio", "music.mp3");
  if (existsSync(music)) {
    mkdirSync(join(PUBLIC, "audio"), { recursive: true });
    copyFileSync(music, join(PUBLIC, "audio", "music.mp3"));
    return { music: true };
  }
  return { music: false };
}

let bundled: string | null = null;
/** Bundles the Remotion project once per run. */
export async function bundleOnce(): Promise<string> {
  if (bundled) return bundled;
  const { bundle } = await import("@remotion/bundler");
  bundled = await bundle({ entryPoint: join(VIDEO, "src", "index.ts"), publicDir: PUBLIC });
  return bundled;
}

export async function render(id: string, output: string, inputProps: Record<string, unknown> = {}) {
  const { selectComposition, renderMedia } = await import("@remotion/renderer");
  const serveUrl = await bundleOnce();
  const composition = await selectComposition({ serveUrl, id, inputProps });
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    crf: 12,
    pixelFormat: "yuv420p",
    imageFormat: "png",
    audioCodec: "aac",
    audioBitrate: "320k",
    // Fewer workers use less memory (each is a browser tab decoding video): RENDER_CONCURRENCY=2.
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 6),
    outputLocation: output,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== last) {
        last = p;
        process.stdout.write(` ${p * 10}%`);
      }
    },
  });
  process.stdout.write("\n");
}

export async function still(id: string, output: string, frame: number, inputProps: Record<string, unknown> = {}) {
  const { selectComposition, renderStill } = await import("@remotion/renderer");
  const serveUrl = await bundleOnce();
  const composition = await selectComposition({ serveUrl, id, inputProps });
  await renderStill({ serveUrl, composition, inputProps, frame, output, imageFormat: "png" });
}

const TAKES = ["landing", "demo", "doze"];
const ASPECTS = ["9x16", "16x9"];
const CAPTURE_URL = "http://localhost:3123/demo";

async function up(): Promise<boolean> {
  try {
    return (await fetch(CAPTURE_URL, { signal: AbortSignal.timeout(60_000) })).ok;
  } catch {
    return false;
  }
}

/**
 * The frame captures are big (about 900 MB) and safe to delete: if any take is missing, this
 * starts the site (`next dev` on port 3123, unless it's already up), records what's missing
 * with scripts/capture.ts, and stops the site again. About 15 minutes for everything.
 */
export async function ensureCaptures(): Promise<void> {
  const missing = ASPECTS.flatMap((a) => TAKES.filter((t) => !existsSync(join(PUBLIC, "capture", a, t, "meta.json"))).map((t) => [a, t] as const));
  if (!missing.length) return;
  console.log(`captures missing (${missing.map(([a, t]) => `${a} ${t}`).join(", ")}): recording them from the site`);
  const { spawn } = await import("node:child_process");
  let server: ReturnType<typeof spawn> | null = null;
  if (!(await up())) {
    server = spawn("npx", ["next", "dev", "-p", "3123"], { cwd: REPO, shell: true, stdio: "ignore" });
    const t0 = Date.now();
    while (!(await up())) {
      if (Date.now() - t0 > 180_000) throw new Error("the site didn't start on :3123 within 3 minutes");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  try {
    for (const a of ASPECTS) {
      const takes = missing.filter(([x]) => x === a).map(([, t]) => t);
      if (takes.length) run(process.execPath, ["--import", "tsx", join(VIDEO, "scripts", "capture.ts"), a, takes.join(",")], { quiet: false });
    }
  } finally {
    // Only if we started it. npx hands next to a process outside the shell's tree, so stop
    // the shell's tree and whatever is listening on :3123.
    if (server?.pid) {
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
      const net = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }).stdout ?? "";
      const pids = new Set(net.split(/\r?\n/).filter((l) => /:3123\s.*LISTENING/.test(l)).map((l) => l.trim().split(/\s+/).pop()!));
      for (const pid of pids) spawnSync("taskkill", ["/pid", pid, "/T", "/F"]);
    }
  }
}
