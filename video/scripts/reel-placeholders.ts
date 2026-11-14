// Placeholder footage for testing `npm run reel` end to end before the shoot: one clip per
// shot in footage/raw, a colour card with the shot's name, each line spoken by Windows' built-in
// voice as takes the way the real shoot goes (one with an "um", one cut short, one clean, in
// varying order), silence between takes. Reaction and b-roll clips are silent cards.
// Usage: npm run reel:placeholders   (then `npm run reel`; delete footage/raw when done)

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, ffmpeg, probe, run, VIDEO } from "./lib";

const RAW = join(VIDEO, "footage", "raw");
const TTS = join(CACHE, "placeholder-tts");
const ANSWER = "The code is the truth. CrowdNet isn't trained yet, so the prediction is the live count plus noise. The model was the plan for Sunday.";
const script = JSON.parse(readFileSync(join(VIDEO, "reel", "script.json"), "utf8")) as { shots: Record<string, { line: string | null }> };
const COLORS = ["0x2b2d42", "0x3d405b", "0x1d3557", "0x264653", "0x2a1e3b", "0x3a2e2a", "0x283618", "0x33313b", "0x2f2f2f", "0x1b263b"];

rmSync(TTS, { recursive: true, force: true });
mkdirSync(TTS, { recursive: true });
mkdirSync(RAW, { recursive: true });

type U = { file: string; text: string };
const plan: { shot: string; takes: U[] }[] = Object.entries(script.shots).map(([shot, s], i) => {
  const line = s.line ?? (shot.startsWith("04") ? ANSWER : null);
  if (!line) return { shot, takes: [] };
  const words = line.split(" ");
  const flub = words.slice(0, Math.max(2, Math.ceil(words.length / 2))).join(" ") + ". Sorry, again.";
  const variants = [["um, " + line, line], [flub, line, "um, " + line], [line, "uh, " + line]][i % 3];
  return { shot, takes: variants.map((text, ti) => ({ file: join(TTS, `${shot}-${ti}.wav`), text })) };
});

const list = join(TTS, "list.json");
writeFileSync(list, JSON.stringify(plan.flatMap((p) => p.takes)));
run("powershell", [
  "-NoProfile",
  "-Command",
  `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; foreach ($u in (Get-Content -Raw '${list.replace(/'/g, "''")}' | ConvertFrom-Json)) { $s.SetOutputToWaveFile($u.file); $s.Speak($u.text) }; $s.Dispose()`,
]);

plan.forEach(({ shot, takes }, i) => {
  const color = COLORS[i % COLORS.length];
  const out = join(RAW, `${shot}.mp4`);
  let audio: string | null = null;
  if (takes.length) {
    audio = join(TTS, `${shot}.wav`);
    const ins = takes.flatMap((t) => ["-i", t.file]);
    const chain = takes.map((_, k) => `[${k}:a]aresample=48000,adelay=600|600,apad=pad_dur=1.6[a${k}]`).join(";");
    ffmpeg([...ins, "-filter_complex", `${chain};${takes.map((_, k) => `[a${k}]`).join("")}concat=n=${takes.length}:v=0:a=1[a]`, "-map", "[a]", audio]);
  }
  const seconds = audio ? Number(probe(audio).format.duration).toFixed(3) : "6";
  ffmpeg([
    "-f", "lavfi", "-i", `color=c=${color}:size=1080x1920:rate=30:duration=${seconds}`,
    ...(audio ? ["-i", audio] : ["-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${seconds}`]),
    "-filter_complex", `[0:v]drawtext=text='PLACEHOLDER ${shot}':fontcolor=white:fontsize=72:x=(w-tw)/2:y=820,drawtext=text='%{pts\\:hms}':fontcolor=white@0.7:fontsize=48:x=(w-tw)/2:y=940,format=yuv420p[v]`,
    "-map", "[v]", "-map", "1:a", "-t", seconds, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "192k", out,
  ]);
  console.log(`  ${shot}.mp4  ${seconds}s, ${takes.length || "no"} takes`);
});
rmSync(TTS, { recursive: true, force: true });
console.log(`placeholder footage in ${RAW}`);
