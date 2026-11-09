// Checkpoint 1: one finished still per scene, with Instagram's overlay zones drawn on, plus a
// contact sheet. Usage: npm run style-frames [-- --clean] (--clean leaves the overlay off).

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ffmpeg, OUT, preparePublic, still } from "./lib";

const SCENES = ["1a", "1b", "2", "3a", "3b", "4", "5", "6", "7", "8", "9"];
const clean = process.argv.includes("--clean");
const dir = join(OUT, "v2", clean ? "style-frames-clean" : "style-frames");
mkdirSync(dir, { recursive: true });
await preparePublic();
for (const s of SCENES) {
  await still(`sf-${s}`, join(dir, `scene-${s}.png`), 0, { scene: s, safeZones: !clean });
  console.log(`scene ${s}`);
}
// Contact sheet: two rows, labelled.
const inputs = SCENES.flatMap((s) => ["-i", join(dir, `scene-${s}.png`)]);
const tiles = SCENES.map((s, i) => `[${i}]scale=360:640,pad=376:700:8:8:0x0a0a0b,drawtext=text='${s}':fontcolor=0xb5b5b8:fontsize=28:x=14:y=658[t${i}]`).join(";");
const row = (from: number, n: number, name: string) => `${Array.from({ length: n }, (_, i) => `[t${from + i}]`).join("")}hstack=inputs=${n}[${name}]`;
ffmpeg([...inputs, "-filter_complex", `${tiles};${row(0, 6, "r0")};${row(6, 5, "r1p")};[r1p]pad=376*6:700:0:0:0x0a0a0b[r1];[r0][r1]vstack=2`, join(dir, "contact-sheet.png")]);
console.log(join(dir, "contact-sheet.png"));
