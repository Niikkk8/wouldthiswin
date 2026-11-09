// Turns the captures' per-frame metadata into the launch video's timeline: which captured
// frames each scene plays, where the captions sit, and when each sound lands. Cut points
// are found from what was on screen (the act, the odds chip, a judge's face), never
// hard-coded frame numbers, so a fresh capture lines up on its own.
// Writes src/plan.json. Usage: npm run plan (render.ts runs it too).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CAP = join(import.meta.dirname, "..", "public", "capture");
const FPS = 30;

type Meta = {
  f: number;
  step: string | null;
  odds: string | null;
  chip: string | null;
  judges: string[];
  answer: number;
  typed: number;
  lines: number;
  chat: number;
  button: string | null;
};

export type Sfx = "click" | "whoosh" | "thud" | "tap" | "chime";
export type Cue = { f: number; sfx: Sfx; volume: number };
export type Scene =
  | { kind: "hook"; duration: number; swapAt: number }
  | { kind: "end"; duration: number }
  | { kind: "capture"; duration: number; take: string; from: number; caption?: { text: string; top: number; at?: number }; shift: number };
export type Plan = { aspect: string; scenes: Scene[]; cues: Cue[]; duration: number; cover: number; captions: { from: number; to: number; text: string }[]; key: number[]; answerDrop: number };

const load = (aspect: string, take: string): Meta[] => JSON.parse(readFileSync(join(CAP, aspect, take, "meta.json"), "utf8"));

function first(meta: Meta[], test: (m: Meta) => boolean, after = 0, what = "frame"): number {
  const m = meta.find((x) => x.f >= after && test(x));
  if (!m) throw new Error(`plan: no ${what} found`);
  return m.f;
}

/** Frames where a counter goes up, at most one every `gap` frames (typing clicks). */
function rises(meta: Meta[], from: number, to: number, key: (m: Meta) => number, gap: number): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (let f = from + 1; f < to && f < meta.length; f++) {
    if (key(meta[f]) > key(meta[f - 1]) && f - last >= gap) {
      out.push(f);
      last = f;
    }
  }
  return out;
}

const chipDelta = (m: Meta) => {
  const n = m.chip?.match(/^([+-]\d+)/);
  return n ? Number(n[1]) : 0;
};

export function plan(aspect: "9x16" | "16x9"): Plan {
  const tall = aspect === "9x16";
  const landing = load(aspect, "landing");
  const demo = load(aspect, "demo");
  const doze = load(aspect, "doze");
  // 9:16: the phone layout moves up a little so the odds and the answer clear Instagram's
  // bottom overlay; the header goes under its top bar. 16:9 plays as captured.
  const shift = tall ? -136 : 0;
  const capTop = tall ? 1385 : 950;

  const scenes: Scene[] = [];
  const cues: Cue[] = [];
  let at = 0;
  const add = (s: Scene, local: Cue[] = []) => {
    for (const c of local) cues.push({ ...c, f: c.f + at });
    scenes.push(s);
    at += s.duration;
  };
  const fromCapture = (meta: Meta[], from: number, duration: number, frames: number[], sfx: Sfx, volume: number): Cue[] =>
    frames.filter((f) => f >= from && f < from + duration).map((f) => ({ f: f - from, sfx, volume }));

  // 1-2. The hook, then "would this win?" (5s).
  add({ kind: "hook", duration: 150, swapAt: 90 });

  // 3. The repo typed, "Face the panel" pressed (3s).
  {
    const press = first(landing, (m) => m.button === "Finding a panel", 0, "button press");
    const from = press + 24 - 90;
    const clicks = rises(landing, from, from + 90, (m) => m.typed, 2);
    add({ kind: "capture", take: "landing", from, duration: 90, shift }, [
      ...fromCapture(landing, from, 90, clicks, "click", 0.35),
      { f: press - 4 - from, sfx: "tap", volume: 0.45 },
    ]);
  }

  // 4. The scan, odds 50 to 31 with the shake (7s).
  let dropAt = 0;
  {
    const ready = first(demo, (m) => /continue/i.test(m.button ?? ""), 0, "scan end");
    const from = Math.max(first(demo, (m) => !!m.step), ready + 12 - 210);
    const beams = rises(demo, from, from + 210, (m) => m.lines, 6);
    const drops: number[] = [];
    for (let f = from + 1; f < from + 210; f++) if (demo[f].chip !== demo[f - 1].chip && chipDelta(demo[f]) <= -9) drops.push(f);
    // The cover holds the drop: the red chip up, the number settled, just before the next claim lands.
    const d0 = drops[0] ?? from;
    const nextChip = demo.find((m) => m.f > d0 && m.chip !== demo[d0].chip)?.f ?? d0 + 24;
    dropAt = at + Math.max(d0 + 19, nextChip - 3) - from;
    add({ kind: "capture", take: "demo", from, duration: 210, shift, caption: { text: "it reads your actual code", top: capTop } }, [
      ...fromCapture(demo, from, 210, beams, "whoosh", 0.4),
      ...fromCapture(demo, from, 210, drops, "thud", 0.8),
    ]);
  }

  // 5. The Engineer asks, the answer types, the others react (10s).
  {
    const g = first(demo, (m) => m.step?.startsWith("Act 2") ?? false, 0, "grilling");
    const from = g + 2;
    const clicks = rises(demo, from, from + 300, (m) => m.answer, 2);
    add({ kind: "capture", take: "demo", from, duration: 300, shift, caption: { text: "three judges. 30 seconds a question.", top: capTop } }, fromCapture(demo, from, 300, clicks, "click", 0.3));
  }

  // 6. The Tired Judge nods off (5s).
  {
    const dozing = first(doze, (m) => m.judges[0] === "tired:dozing", 0, "the Tired Judge dozing");
    const from = dozing - 45;
    add({ kind: "capture", take: "doze", from, duration: 150, shift, caption: { text: "one of them is very tired", top: capTop } });
  }

  // 7. The deliberation, messages arriving, the odds replay (6.5s).
  let reviewFrom = 0;
  {
    const d = first(demo, (m) => m.step?.startsWith("Act 3") ?? false, 0, "deliberation");
    const r = first(demo, (m) => m.step?.startsWith("Act 4") ?? false, d, "review");
    const from = d - 4;
    const duration = Math.min(210, r - 2 - from);
    reviewFrom = r;
    const pops = rises(demo, from, from + duration, (m) => m.chat, 8);
    add({ kind: "capture", take: "demo", from, duration, shift, caption: { text: "they talk about you. in front of you.", top: capTop } }, fromCapture(demo, from, duration, pops, "click", 0.22));
  }

  // 8. The review: changes requested at 34%, then the fixes (5s).
  const verdict = at;
  // On 9:16 the fixes fill the lower half once it scrolls, so the caption goes short and
  // high, over the review comments, clear of the verdict above and all three fixes below.
  // It waits for the scroll (the capture holds the verdict ~2s first: see capture.ts), so the
  // verdict and 34% show clean before it.
  const reviewCaption = tall ? { text: "and tell you what to fix", top: 470, at: 56 } : { text: "and tell you what to fix before you submit", top: capTop };
  add({ kind: "capture", take: "demo", from: reviewFrom + 4, duration: 150, shift, caption: reviewCaption }, [{ f: 3, sfx: "tap", volume: 0.6 }]);

  // 9. The end card (4s).
  const end = at;
  add({ kind: "end", duration: 120 }, [{ f: 4, sfx: "chime", volume: 0.5 }]);

  const captions: Plan["captions"] = [];
  let t = 0;
  for (const s of scenes) {
    if (s.kind === "capture" && s.caption) captions.push({ from: t + (s.caption.at ?? 0), to: t + s.duration, text: s.caption.text });
    t += s.duration;
  }
  captions.unshift({ from: 0, to: 90, text: "the night before submission, every team asks one question" }, { from: 90, to: 150, text: "would this win?" });
  captions.push({ from: end, to: at, text: "wouldthiswin.com. free. no sign-up." });

  // For the face reel: the demo frame where the third answer's -4 lands (odds 38 to 34).
  const g2 = first(demo, (m) => m.step?.startsWith("Act 2") ?? false, 0, "grilling");
  const answerDrop = first(demo, (m) => /^-4/.test(m.chip ?? ""), g2, "the third answer's drop");

  return {
    aspect,
    answerDrop,
    scenes,
    cues,
    duration: at,
    // The cover: the SMS claim has just dropped the odds to 31%, chip and caption up.
    cover: dropAt,
    captions,
    // The music ducks under these.
    key: [...cues.filter((c) => c.sfx !== "click" && c.sfx !== "whoosh").map((c) => c.f), verdict],
  };
}

if (process.argv[1]?.endsWith("plan.ts")) {
  const out: Record<string, Plan> = {};
  for (const a of ["9x16", "16x9"] as const) {
    if (!existsSync(join(CAP, a, "demo", "meta.json"))) {
      console.log(`plan: no ${a} capture yet, skipped`);
      continue;
    }
    out[a] = plan(a);
    console.log(`plan ${a}: ${out[a].scenes.length} scenes, ${(out[a].duration / FPS).toFixed(1)}s, ${out[a].cues.length} sounds`);
  }
  writeFileSync(join(import.meta.dirname, "..", "src", "plan.json"), JSON.stringify(out, null, 1));
}
