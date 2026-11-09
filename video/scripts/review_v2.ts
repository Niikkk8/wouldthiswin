// claude-motion's review loop for the v2 launch video: a half-resolution draft, then contact
// sheets of frames at every timeline beat that matters (0.3 s after it, so motion has
// settled), labelled with their timestamps. 9:16 drafts carry the Instagram safe-zone overlay.
//
// Usage: tsx scripts/review_v2.ts <9x16|16x9> [--times 1.2,3.4] [--no-render]

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bundleOnce, ffmpeg, OUT, preparePublic } from "./lib";

const aspect = process.argv[2] ?? "9x16";
const timesArg = process.argv.indexOf("--times");
const dir = join(OUT, "v2", "review");
mkdirSync(dir, { recursive: true });
const videoArg = process.argv.indexOf("--video");
const draft = videoArg >= 0 ? process.argv[videoArg + 1] : join(dir, `draft-${aspect}.mp4`);
const sheetName = videoArg >= 0 ? `contact-sheet-${draft.split(/[\\/]/).pop()!.replace(/\.mp4$/, "")}` : null;

if (!process.argv.includes("--no-render") && videoArg < 0) {
  await preparePublic();
  const { selectComposition, renderMedia } = await import("@remotion/renderer");
  const serveUrl = await bundleOnce();
  const id = aspect === "9x16" ? "launch-v2-9x16-safe" : "launch-v2-16x9";
  const composition = await selectComposition({ serveUrl, id });
  await renderMedia({ serveUrl, composition, codec: "h264", crf: 24, scale: 0.5, concurrency: 8, outputLocation: draft, muted: true });
}

const tl = JSON.parse(readFileSync(join(import.meta.dirname, "..", "src", "v2", "timeline.json"), "utf8"));
const S = tl.scenes;
const moments: [string, number][] =
  timesArg >= 0
    ? process.argv[timesArg + 1].split(",").map((x) => [x, Number(x)])
    : [
        ["1a start", 0],
        ["1a mid", 2.4],
        ["1b slam", S["1b"].slam + 0.3],
        ["2 typing", S["2"].typeStart + 0.6],
        ["2 press", S["2"].press + 0.15],
        ["2>3a zoom", S["3a"].start - 0.2],
        ["3a cascade", S["3a"].cascade + 0.6],
        ["3a beams", S["3a"].beams[2] + 0.3],
        ["3a red", S["3a"].red + 0.3],
        ["3b cut", S["3b"].cut + 0.05],
        ["3b drop", S["3b"].drop + 0.08],
        ["3b settled", S["3b"].drop + 1.2],
        ["4 slide", S["4"].slide[2] + 0.3],
        ["4 punch", S["4"].punch + 0.3],
        ["4 named", S["4"].punch + 0.8],
        ["4 typed", S["4"].qStart + 2],
        ["5 typing", S["5"].typeStart + 0.8],
        ["5 punch", S["5"].punch + 0.6],
        ["5 tick", S["5"].tick + 0.3],
        ["5>6 wipe", S["6"].start - 0.18],
        ["6 doze", S["6"].start + 1.4],
        ["6 named", S["6"].start + 2.8],
        ["6 pause", S["6"].pause[0] + 0.3],
        ["6 jolt", S["6"].jolt + 0.15],
        ["7 bubbles", S["7"].bubbles[3] + 0.3],
        ["7 end", S["7"].end - 0.3],
        ["8 flip", S["8"].flip + 0.3],
        ["8 fixes", S["8"].fixes[2] + 0.5],
        ["8 end", S["8"].end - 0.5],
        ["9 logo mid", S["9"].logo + 0.45],
        ["9 landed", S["9"].logoLand + 0.3],
        ["9 end", tl.duration - 0.2],
      ];

const tall = aspect === "9x16";
const tw = tall ? 270 : 480;
const th = tall ? 480 : 270;
const cols = tall ? 8 : 5;
const tiles = moments.map(([name, t], i) => {
  const p = join(dir, `tile-${i}.png`);
  ffmpeg(["-ss", t.toFixed(3), "-i", draft, "-frames:v", "1", "-vf", `scale=${tw}:${th},pad=iw:ih+40:0:0:0x0a0a0b,drawtext=text='${name} @ ${t.toFixed(2)}s':fontcolor=0xb5b5b8:fontsize=20:x=8:y=h-30`, p]);
  return p;
});
const rows: string[] = [];
for (let r = 0; r * cols < tiles.length; r++) {
  const part = tiles.slice(r * cols, (r + 1) * cols);
  const out = join(dir, `row-${aspect}-${r}.png`);
  ffmpeg([...part.flatMap((p) => ["-i", p]), "-filter_complex", `${part.map((_, i) => `[${i}]`).join("")}hstack=inputs=${part.length}${part.length < cols ? `,pad=${cols * tw}:ih:0:0:0x0a0a0b` : ""}`, out]);
  rows.push(out);
}
for (let r = 0; r < rows.length; r++) console.log(rows[r]);
if (sheetName) {
  const out = join(OUT, "v2", `${sheetName}.png`);
  ffmpeg([...rows.flatMap((p) => ["-i", p]), "-filter_complex", `${rows.map((_, i) => `[${i}]`).join("")}vstack=inputs=${rows.length}`, out]);
  console.log(out);
}
