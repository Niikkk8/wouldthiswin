// Delivery check: every mp4 in out/ (or the paths given) against Instagram, X and LinkedIn's
// published upload specs, plus our own (-14 LUFS, -20 for the launch's Instagram cut, -1 dBTP, 30fps, exact frame size).
// Usage: npm run check [-- file.mp4 ...]. Exits non-zero if anything fails.

import { openSync, readdirSync, readSync, closeSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { CACHE, measure, OUT, probe } from "./lib";

type Row = { file: string; check: string; value: string; ok: boolean };

/** Where a file goes, by name. */
function targets(file: string): string[] {
  if (file.includes("16x9")) return ["X", "LinkedIn"];
  if (file.endsWith("-ig.mp4") || file.includes("-ig-")) return ["Instagram"];
  if (file.includes("linkedin")) return ["LinkedIn"];
  return ["Instagram", "X", "LinkedIn"];
}

/** True if the moov atom comes before mdat (plays while downloading; some uploaders want it). */
function faststart(file: string): boolean {
  const fd = openSync(file, "r");
  const buf = Buffer.alloc(16);
  let pos = 0;
  const size = statSync(file).size;
  try {
    while (pos < size) {
      readSync(fd, buf, 0, 16, pos);
      let len = buf.readUInt32BE(0);
      const type = buf.toString("latin1", 4, 8);
      if (type === "moov") return true;
      if (type === "mdat") return false;
      if (len === 1) len = Number(buf.readBigUInt64BE(8));
      if (len < 8) return false;
      pos += len;
    }
  } finally {
    closeSync(fd);
  }
  return false;
}

export function check(file: string): Row[] {
  const p = probe(file);
  const v = p.streams.find((s) => s.codec_type === "video")!;
  const a = p.streams.find((s) => s.codec_type === "audio");
  const dur = Number(p.format.duration);
  const mb = Number(p.format.size) / 1e6;
  const [num, den] = (v.r_frame_rate ?? "0/1").split("/").map(Number);
  const fps = num / den;
  const vMbps = Number(v.bit_rate ?? p.format.bit_rate) / 1e6;
  const tall = (v.height ?? 0) > (v.width ?? 0);
  const rows: Row[] = [];
  const add = (check: string, value: string | number, ok: boolean) => rows.push({ file: basename(file), check, value: String(value), ok });
  const to = targets(basename(file));

  add("container", p.format.format_name, p.format.format_name.includes("mp4"));
  add("video codec", `${v.codec_name} ${v.profile ?? ""}`.trim(), v.codec_name === "h264" && /high|main/i.test(v.profile ?? ""));
  add("pixel format", v.pix_fmt ?? "?", v.pix_fmt === "yuv420p");
  add("frame size", `${v.width}x${v.height}`, tall ? v.width === 1080 && v.height === 1920 : v.width === 1920 && v.height === 1080);
  add("frame rate", `${fps.toFixed(3)} fps (${v.r_frame_rate}, avg ${v.avg_frame_rate})`, fps === 30 && v.avg_frame_rate === "30/1");
  add("video bitrate", `${vMbps.toFixed(2)} Mbps`, vMbps <= 25);
  add("faststart", faststart(file) ? "moov first" : "moov last", faststart(file));
  add("audio codec", a ? `${a.codec_name} ${a.profile ?? ""} ${a.sample_rate}Hz ${a.channels}ch` : "none", !!a && a.codec_name === "aac" && a.sample_rate === "48000" && a.channels === 2);
  if (a) {
    // The launch's Instagram cut sits under a trending song, so it's mastered to -20; the rest to -14.
    // v2's Instagram cut (voice + effects, no music) is mastered to -16; v1's effects-only one to -20.
    const ig = /^launch.*-ig\.mp4$/.test(basename(file));
    const target = ig ? (/[\\/]v2[\\/]/.test(file) ? -16 : -20) : -14;
    const l = measure(file, target);
    add(`loudness (target ${target})`, `${l.input_i} LUFS integrated`, Math.abs(Number(l.input_i) - target) <= 1);
    add("true peak (below -1)", `${l.input_tp} dBTP`, Number(l.input_tp) < -1);
  }
  add("size", `${mb.toFixed(1)} MB`, true);
  add("duration", `${dur.toFixed(2)}s`, dur >= 3);
  for (const t of to) {
    if (t === "Instagram") {
      add("Instagram Reels: 9:16, 3s-3min, <4GB, 23-60fps", `${dur.toFixed(1)}s`, tall && dur >= 3 && dur <= 180 && mb < 4000 && fps >= 23 && fps <= 60);
      add("Instagram feed autoplay: under 90s", `${dur.toFixed(1)}s`, dur <= 90);
    }
    if (t === "X") add("X: H.264 High/Main, AAC, <=512MB, 0.5-140s, <=60fps, <=1920x1200", `${dur.toFixed(1)}s, ${mb.toFixed(1)}MB`, mb <= 512 && dur >= 0.5 && dur <= 140 && fps <= 60 && Math.max(v.width!, v.height!) <= 1920);
    if (t === "LinkedIn") add("LinkedIn: 3s-15min, 75KB-5GB, 10-60fps", `${dur.toFixed(1)}s, ${mb.toFixed(1)}MB`, dur >= 3 && dur <= 900 && mb >= 0.075 && mb <= 5000 && fps >= 10 && fps <= 60);
  }
  return rows;
}

if (process.argv[1]?.endsWith("check.ts")) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : readdirSync(OUT)
        .filter((f) => f.endsWith(".mp4"))
        .map((f) => join(OUT, f));
  const rows = files.flatMap(check);
  for (const f of files) {
    console.log(`\n${basename(f)}`);
    for (const r of rows.filter((r) => r.file === basename(f))) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.check.padEnd(64)} ${r.value}`);
  }
  writeFileSync(join(CACHE, "check.json"), JSON.stringify(rows, null, 1));
  const bad = rows.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} check(s) failed` : "\nall checks passed");
  process.exitCode = bad.length ? 1 : 0;
}
