// Renders the launch video: plans the cuts from the captures, renders each version, masters
// each to -14 LUFS, and writes the cover and captions. Then runs the delivery check.
//
//   launch-16x9.mp4      sound effects + music   (X, Peerlist, Reddit)
//   launch-9x16.mp4      sound effects + music   (LinkedIn)
//   launch-9x16-ig.mp4   sound effects only      (Instagram, trending audio added in-app)
//   cover-9x16.png       the odds-drop frame
//   captions.srt         the on-screen captions
//
// Without video/audio/music.mp3 the music slot stays empty (the "+ music" files have none).
// Usage: npm run render [-- 9x16|16x9]

import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { plan, type Plan } from "./plan";
import { CACHE, ensureCaptures, master, OUT, preparePublic, render, still } from "./lib";

const only = process.argv[2];
await ensureCaptures();
const { music } = await preparePublic();
console.log(music ? "music: audio/music.mp3" : "music: none yet (video/audio/music.mp3 missing), slot left empty");

const plans: Record<string, Plan> = { "9x16": plan("9x16"), "16x9": plan("16x9") };
writeFileSync(join(import.meta.dirname, "..", "src", "plan.json"), JSON.stringify(plans, null, 1));

mkdirSync(OUT, { recursive: true });
const tmp = join(CACHE, "render");
mkdirSync(tmp, { recursive: true });

// The Instagram cut has no music (a trending song goes on in-app), so it's mastered quieter:
// the effects stay under the song instead of competing with it.
const versions = [
  { aspect: "16x9", file: "launch-16x9.mp4", music, lufs: -14 },
  { aspect: "9x16", file: "launch-9x16.mp4", music, lufs: -14 },
  { aspect: "9x16", file: "launch-9x16-ig.mp4", music: false, lufs: -20 },
].filter((v) => !only || v.aspect === only);

const report: Record<string, unknown> = {};
/** Raw renders by aspect and music, kept until the end so a version can be re-mastered. */
const rendered = new Map<string, string>();
for (const v of versions) {
  // Same picture and sound as one already made (no music yet): copy it.
  const twin = Object.entries(report).find(([f, r]) => f.includes(v.aspect) && (r as { music: boolean }).music === v.music && (r as { target: number }).target === v.lufs);
  if (twin) {
    copyFileSync(join(OUT, twin[0]), join(OUT, v.file));
    report[v.file] = { ...(twin[1] as object), copyOf: twin[0] };
    console.log(`  ${v.file}: same as ${twin[0]} (no music), copied`);
    continue;
  }
  // Same picture and mix as one already rendered, different loudness: master that render again.
  const sibling = rendered.get(`${v.aspect}:${v.music}`);
  if (sibling) {
    const loud = master(sibling, join(OUT, v.file), v.lufs);
    report[v.file] = { music: v.music, target: v.lufs, lufs: Number(loud.after.input_i), truePeak: Number(loud.after.input_tp), masteredFrom: basename(sibling) };
    console.log(`  ${v.file}: ${loud.after.input_i} LUFS, ${loud.after.input_tp} dBTP (same render, mastered to ${v.lufs})`);
    continue;
  }
  const raw = join(tmp, v.file);
  const t0 = Date.now();
  process.stdout.write(`render ${v.file}:`);
  await render(`launch-${v.aspect}`, raw, { music: v.music });
  const loud = master(raw, join(OUT, v.file), v.lufs);
  rendered.set(`${v.aspect}:${v.music}`, raw);
  report[v.file] = { music: v.music, target: v.lufs, lufs: Number(loud.after.input_i), truePeak: Number(loud.after.input_tp), seconds: Math.round((Date.now() - t0) / 1000) };
  console.log(`  ${v.file}: ${loud.after.input_i} LUFS, ${loud.after.input_tp} dBTP`);
}

for (const raw of rendered.values()) rmSync(raw);

if (!only || only === "9x16") {
  await still("launch-9x16", join(OUT, "cover-9x16.png"), plans["9x16"].cover);
  console.log("cover-9x16.png at frame", plans["9x16"].cover);
}

// Captions, timed to the 9:16 cut (both cuts share the same timeline).
const ts = (f: number) => {
  const ms = Math.round((f / 30) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = plans["9x16"].captions.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n");
writeFileSync(join(OUT, "captions.srt"), srt);
writeFileSync(join(CACHE, "render-report.json"), JSON.stringify(report, null, 1));
console.log("captions.srt written");
