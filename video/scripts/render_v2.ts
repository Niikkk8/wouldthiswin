// The v2 launch video, end to end:
//   1. beats: audio/music.mp3 if it exists (beats detected), else a 100 BPM grid for the synth bed
//   2. plan (scripts/plan_v2.py) -> src/v2/timeline.json
//   3. music: the synthesized bed (skipped when a real track is used)
//   4. mix (scripts/mix_v2.py): voice, music, effects -> three mixes
//   5. picture: Remotion renders 9:16 and 16:9, silent
//   6. mux + master each version to its loudness target
//   7. cover, delivery checks, contact sheets
// Usage: npm run render:v2 [-- --picture-only | --audio-only]

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "./check";
import { CACHE, ffmpeg, master, measure, OUT, preparePublic, probe, render, run, still, VIDEO } from "./lib";

const PY = join(VIDEO, ".venv", "Scripts", "python.exe");
const V2 = join(OUT, "v2");
const TMP = join(CACHE, "render-v2");
mkdirSync(V2, { recursive: true });
mkdirSync(TMP, { recursive: true });
const audioOnly = process.argv.includes("--audio-only");
const pictureOnly = process.argv.includes("--picture-only");

// 1. Beats.
const track = join(VIDEO, "audio", "music.mp3");
if (existsSync(track)) {
  console.log("music: audio/music.mp3 -> detecting beats");
  run(PY, [join(VIDEO, "scripts", "beats_from_track.py"), track], { quiet: false });
} else {
  console.log("music: no audio/music.mp3 -> the synthesized 120 BPM bed");
  writeFileSync(join(VIDEO, "audio", "beats.json"), JSON.stringify({ source: "synth", bpm: 120, beats: Array.from({ length: 100 }, (_, i) => +(i * 0.5).toFixed(4)) }));
}
// 2-4. Plan, music, mix.
run(PY, [join(VIDEO, "scripts", "plan_v2.py")], { quiet: false });
if (!existsSync(track)) run(PY, [join(VIDEO, "scripts", "music.py")], { quiet: false });
run(PY, [join(VIDEO, "scripts", "mix_v2.py")], { quiet: false });

// 5. Picture.
await preparePublic();
const silent = { "9x16": join(TMP, "silent-9x16.mp4"), "16x9": join(TMP, "silent-16x9.mp4") };
if (!audioOnly) {
  for (const a of ["9x16", "16x9"] as const) {
    process.stdout.write(`render ${a}:`);
    await render(`launch-v2-${a}`, silent[a], { aspect: a, safeZones: false });
  }
}

// 6. Versions.
const versions = [
  { file: "launch-9x16-vo.mp4", aspect: "9x16", mix: "vo", lufs: -14 },
  { file: "launch-16x9-vo.mp4", aspect: "16x9", mix: "vo", lufs: -14 },
  { file: "launch-9x16-ig.mp4", aspect: "9x16", mix: "ig", lufs: -16 },
  { file: "launch-9x16.mp4", aspect: "9x16", mix: "novo", lufs: -14 },
  { file: "launch-16x9.mp4", aspect: "16x9", mix: "novo", lufs: -14 },
] as const;
const report: Record<string, unknown> = {};
if (!pictureOnly) {
  for (const v of versions) {
    const muxed = join(TMP, v.file);
    // The audio is cut to the picture's exact length; picture copied untouched.
    const seconds = Number(probe(silent[v.aspect]).format.duration).toFixed(3);
    ffmpeg(["-i", silent[v.aspect], "-i", join(VIDEO, "audio", "build", `mix-${v.mix}.wav`), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "pcm_s24le", "-t", seconds, muxed.replace(/\.mp4$/, ".mov")]);
    const loud = master(muxed.replace(/\.mp4$/, ".mov"), join(V2, v.file), v.lufs);
    rmSync(muxed.replace(/\.mp4$/, ".mov"));
    report[v.file] = { lufs: Number(loud.after.input_i), truePeak: Number(loud.after.input_tp), target: v.lufs };
    console.log(`  ${v.file}: ${loud.after.input_i} LUFS, ${loud.after.input_tp} dBTP (target ${v.lufs})`);
  }
}

// 7. Cover: the slam, "would this win?" with the red ? and the panel reacting.
const tl = (await import("../src/v2/timeline.json", { with: { type: "json" } })).default;
await still("launch-v2-9x16", join(V2, "cover-9x16.png"), Math.round((tl.scenes["1b"].slam + 0.75) * 30), { aspect: "9x16", safeZones: false });
writeFileSync(join(V2, "render-report.json"), JSON.stringify(report, null, 1));
const rows = versions.flatMap((v) => (existsSync(join(V2, v.file)) ? check(join(V2, v.file)) : []));
writeFileSync(join(V2, "check.json"), JSON.stringify(rows, null, 1));
const bad = rows.filter((r) => !r.ok);
console.log(bad.length ? `\n${bad.length} delivery check(s) failed:\n${bad.map((r) => `  ${r.file}: ${r.check} = ${r.value}`).join("\n")}` : "\nall delivery checks passed");
void copyFileSync;
void measure;
