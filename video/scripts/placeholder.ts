// Fake footage for testing the reel pipeline end to end: each script line said three times
// by Windows' built-in speech voice over a test pattern, the way the real shoot will go:
// one take cut short, one with an "um", one clean (in varying order). Two files, to test
// several clips at once. Writes .cache/placeholder-footage/. Usage: npm run placeholder

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REEL_SCRIPT } from "../src/reel-script";
import { CACHE, ffmpeg, probe, run } from "./lib";

const DIR = join(CACHE, "placeholder-footage");
const TTS = join(CACHE, "placeholder-tts");
rmSync(DIR, { recursive: true, force: true });
rmSync(TTS, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
mkdirSync(TTS, { recursive: true });

type Utterance = { file: string; text: string; pause: number };
const utterances: Utterance[] = [];
REEL_SCRIPT.forEach((line, li) => {
  const words = line.text.split(" ");
  const flub = words.slice(0, Math.max(2, Math.ceil(words.length * 0.55))).join(" ") + "... sorry, again.";
  const um = "um, " + line.text;
  // The clean take moves around, so "the last take" isn't always the right answer.
  const order = [[flub, um, line.text], [flub, line.text, um], [um, flub, line.text]][li % 3];
  order.forEach((text, ti) => utterances.push({ file: join(TTS, `l${line.id}-t${ti + 1}.wav`), text, pause: ti === 2 ? 2.4 : 1.3 }));
});

// One PowerShell run speaks them all.
const list = join(TTS, "list.json");
writeFileSync(list, JSON.stringify(utterances.map((u) => ({ file: u.file, text: u.text.replace("krish is... tired", "krish is,,, tired") }))));
const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft David Desktop')
$s.Rate = 1
foreach ($u in (Get-Content -Raw '${list.replace(/'/g, "''")}' | ConvertFrom-Json)) {
  $s.SetOutputToWaveFile($u.file)
  $s.Speak($u.text)
}
$s.Dispose()
`;
run("powershell", ["-NoProfile", "-Command", ps]);

// Two parts: lines 1-5 and 6-9, each a run of takes with the pauses between.
const parts = [utterances.filter((u) => /l[1-5]-/.test(u.file)), utterances.filter((u) => /l[6-9]-/.test(u.file))];
parts.forEach((us, pi) => {
  const inputs: string[] = [];
  const chain: string[] = [];
  us.forEach((u, i) => {
    inputs.push("-i", u.file);
    chain.push(`[${i}:a]aresample=48000,apad=pad_dur=${u.pause}[a${i}]`);
  });
  const audio = join(TTS, `part-${pi + 1}.wav`);
  ffmpeg([...inputs, "-filter_complex", `${chain.join(";")};${us.map((_, i) => `[a${i}]`).join("")}concat=n=${us.length}:v=0:a=1[a]`, "-map", "[a]", audio]);
  // A phone-shaped test pattern with a label, and the voice; a little room noise under it.
  // Every source is bounded: -shortest doesn't reach through a filtergraph.
  const seconds = Number(probe(audio).format.duration).toFixed(3);
  ffmpeg([
    "-f", "lavfi", "-i", `testsrc2=size=1080x1920:rate=30:duration=${seconds}`,
    "-i", audio,
    "-f", "lavfi", "-i", `anoisesrc=color=pink:amplitude=0.004:sample_rate=48000:duration=${seconds}`,
    "-filter_complex",
    `[0:v]drawbox=x=140:y=520:w=800:h=880:color=black@0.75:t=fill,drawtext=text='PLACEHOLDER FACE':fontcolor=white:fontsize=84:x=(w-tw)/2:y=600,drawtext=text='part ${pi + 1}  %{pts\\:hms}':fontcolor=white:fontsize=56:x=(w-tw)/2:y=760,format=yuv420p[v];[1:a][2:a]amix=inputs=2:duration=first:normalize=0[a]`,
    "-map", "[v]", "-map", "[a]", "-t", seconds,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "192k",
    join(DIR, `part-${pi + 1}.mp4`),
  ]);
});
rmSync(TTS, { recursive: true, force: true });
console.log(`placeholder footage: ${DIR}`);
