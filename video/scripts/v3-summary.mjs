// Prints, per capture, when each target is on screen (first..last frame, its rect at the
// middle) and when the odds change: what the shot lists in src/v3/edits.json are written from.
import { readFileSync, readdirSync } from "node:fs";
const dir = "public/capture/v3";
const want = process.argv[2] ?? "16x9";
for (const f of readdirSync(dir).filter((f) => f.startsWith(want) && f.endsWith(".json"))) {
  const { frames } = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  console.log(`\n${f} (${frames.length} frames)`);
  const names = [...new Set(frames.flatMap((x) => Object.keys(x.rects)))];
  for (const n of names) {
    const on = frames.filter((x) => x.rects[n]);
    const mid = on[Math.floor(on.length / 2)];
    console.log(`  ${n.padEnd(16)} ${on[0].f}..${on.at(-1).f}  @${mid.f} ${JSON.stringify(mid.rects[n])}`);
  }
  let p = null;
  const ch = [];
  for (const x of frames) if (x.odds !== p) { ch.push(`${x.f}:${x.odds}`); p = x.odds; }
  console.log(`  odds ${ch.join(" ")}  scroll@end ${frames.at(-1).scrollY}`);
}
