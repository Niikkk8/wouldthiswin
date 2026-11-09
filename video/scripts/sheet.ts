// Contact sheets: one frame from the middle of every scene, labelled, from the finished files.
//   out/contact-sheet.png       launch 9:16 and 16:9, a row each
//   out/contact-sheet-reel.png  the face reel, one frame per line (if it's been rendered)
// Usage: npm run sheet [-- <reel.mp4>]

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Plan } from "./plan";
import { CACHE, ffmpeg, OUT, PUBLIC } from "./lib";

const TMP = join(CACHE, "sheet");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const LABELS = ["1-2 hook", "3 repo typed", "4 the scan", "5 the grilling", "6 the tired judge", "7 deliberation", "8 the review", "9 end card"];

/** Grabs frame `t` seconds into `file`, scaled to `w` wide, with a label under it. */
function grab(file: string, t: number, w: number, label: string, out: string) {
  const esc = label.replace(/:/g, "\\:").replace(/'/g, "");
  ffmpeg(["-ss", t.toFixed(3), "-i", file, "-frames:v", "1", "-vf", `scale=${w}:-1:flags=area,pad=iw:ih+56:0:0:0x0a0a0b,drawtext=text='${esc}':fontcolor=0xb5b5b8:fontsize=26:x=12:y=h-42`, out]);
}

function row(file: string, times: { t: number; label: string }[], w: number, name: string): string {
  const tiles = times.map((x, i) => {
    const p = join(TMP, `${name}-${i}.png`);
    grab(file, x.t, w, x.label, p);
    return p;
  });
  const out = join(TMP, `${name}.png`);
  ffmpeg([...tiles.flatMap((t) => ["-i", t]), "-filter_complex", `${tiles.map((_, i) => `[${i}]`).join("")}hstack=inputs=${tiles.length},pad=iw+16:ih+16:8:8:0x0a0a0b`, out]);
  return out;
}

const plans = JSON.parse(readFileSync(join(import.meta.dirname, "..", "src", "plan.json"), "utf8")) as Record<string, Plan>;
const mids = (p: Plan) => {
  let at = 0;
  return p.scenes.map((s, i) => {
    // The hook's two beats share a scene: show the first. The rest: the middle.
    const t = (s.kind === "hook" ? at + 45 : at + s.duration / 2) / 30;
    at += s.duration;
    return { t, label: LABELS[i] ?? `scene ${i + 1}` };
  });
};

const rows: string[] = [];
if (existsSync(join(OUT, "launch-9x16.mp4"))) rows.push(row(join(OUT, "launch-9x16.mp4"), mids(plans["9x16"]), 270, "tall"));
if (existsSync(join(OUT, "launch-16x9.mp4"))) rows.push(row(join(OUT, "launch-16x9.mp4"), mids(plans["16x9"]), 270, "wide"));
if (rows.length) {
  // Rows of different widths: pad to the widest, then stack.
  ffmpeg([...rows.flatMap((r) => ["-i", r]), "-filter_complex", `${rows.map((_, i) => `[${i}]pad=2256:ih:0:0:0x0a0a0b[r${i}]`).join(";")};${rows.map((_, i) => `[r${i}]`).join("")}vstack=inputs=${rows.length}`, join(OUT, "contact-sheet.png")]);
  console.log("out/contact-sheet.png");
}

const reel = process.argv[2] ?? join(OUT, "reel-face-9x16.mp4");
const takes = join(PUBLIC, "reel", "takes.json");
if (existsSync(reel) && existsSync(takes)) {
  const lines = (JSON.parse(readFileSync(takes, "utf8")) as { lines: { id: number; duration: number; layout: string }[] }).lines;
  let at = 0;
  const times = lines.map((l) => {
    const t = at + l.duration * (l.layout === "face-endcard" ? 0.85 : 0.5);
    at += l.duration;
    return { t, label: `${l.id} ${l.layout}` };
  });
  const r = row(reel, times, 240, "reel");
  ffmpeg(["-i", r, join(OUT, reel.includes("placeholder") ? "placeholder-test/contact-sheet-reel-placeholder.png" : "contact-sheet-reel.png")]);
  console.log("reel contact sheet written");
}
rmSync(TMP, { recursive: true, force: true });
