import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import type { Plan } from "../scripts/plan";
import { CaptureFrame, Sprite, useEnter, type Judge } from "./parts";
import { REEL_QUESTIONS, type ReelLayout } from "./reel-script";
import { EndCard } from "./scenes/cards";
import { C, FPS, mono, sans } from "./theme";

/** What scripts/reel.ts writes to public/reel/takes.json. */
export type ReelWord = { text: string; start: number; end: number };
export type ReelLineTake = {
  id: number;
  layout: ReelLayout;
  text: string;
  /** The cut, normalized clip, relative to public/. */
  src: string;
  duration: number;
  /** The script's words, timed from the transcript, in seconds into the clip. */
  words: ReelWord[];
};
export type ReelTakes = { lines: ReelLineTake[]; placeholder?: boolean };
export type ReelProps = { takes: ReelTakes | null; music: boolean; demo: Plan | null };

/** The end card holds this long after the last word. */
export const END_HOLD = 45;
const framesOf = (l: ReelLineTake, last: boolean) => Math.round(l.duration * FPS) + (last ? END_HOLD : 0);

export const reelMetadata: CalculateMetadataFunction<ReelProps> = async ({ props }) => {
  let takes = props.takes;
  if (!takes) {
    const res = await fetch(staticFile("reel/takes.json")).catch(() => null);
    takes = res && res.ok ? ((await res.json()) as ReelTakes) : null;
  }
  const frames = takes ? takes.lines.reduce((n, l, i) => n + framesOf(l, i === takes!.lines.length - 1), 0) : 300;
  return { durationInFrames: Math.max(1, frames), props: { ...props, takes } };
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
/** The time a word (by its normalized text) is first said, at or after `after` seconds. */
function wordAt(words: ReelWord[], text: string, after = 0): number | null {
  const w = words.find((x) => x.start >= after && norm(x.text) === norm(text));
  return w ? w.start : null;
}

/** The face, full frame (the clip is already 1080x1920, graded and cut). */
function Face({ src }: { src: string }) {
  return <OffthreadVideo src={staticFile(src)} style={{ position: "absolute", width: 1080, height: 1920 }} />;
}

/** The face again, muted, in a circle in the lower corner (the full-frame clip carries the sound). */
function FaceCircle({ src }: { src: string }) {
  const d = 380;
  return (
    <div style={{ position: "absolute", left: 48, top: 1010, width: d, height: d, borderRadius: "50%", overflow: "hidden", border: `6px solid ${C.text}`, boxShadow: "0 12px 40px rgba(0,0,0,.6)" }}>
      <OffthreadVideo muted src={staticFile(src)} style={{ position: "absolute", width: d * 1.15, height: ((d * 1.15) / 1080) * 1920, left: -(d * 0.075), top: -d * 0.42 }} />
    </div>
  );
}

/** Word-by-word captions: a short phrase at a time, the word being said highlighted. */
function Words({ words, top, skip = false }: { words: ReelWord[]; top: number; skip?: boolean }) {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (skip || !words.length) return null;
  // Phrases of up to 4 words or ~20 characters, broken after punctuation.
  const phrases: ReelWord[][] = [];
  let cur: ReelWord[] = [];
  for (const w of words) {
    cur.push(w);
    const chars = cur.map((x) => x.text).join(" ").length;
    if (cur.length >= 4 || chars >= 20 || /[.,?!…]$/.test(w.text)) {
      phrases.push(cur);
      cur = [];
    }
  }
  if (cur.length) phrases.push(cur);
  const phrase = [...phrases].reverse().find((p) => p[0].start <= t + 0.05) ?? phrases[0];
  const last = phrase.at(-1)!;
  const next = phrases[phrases.indexOf(phrase) + 1];
  // Gone after the phrase's last word, unless the next starts right away.
  if (t > last.end + 0.6 && (!next || next[0].start > t)) return null;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top, display: "flex", justifyContent: "center" }}>
      <p style={{ margin: 0, fontFamily: sans, fontWeight: 900, fontSize: 76, lineHeight: 1.12, letterSpacing: "-0.03em", textAlign: "center", textShadow: "0 4px 24px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.9)" }}>
        {phrase.map((w, i) => {
          const on = t >= w.start - 0.03 && (t < (phrase[i + 1]?.start ?? last.end + 0.4));
          return (
            <span key={i} style={{ color: on ? C.bg : C.text, background: on ? C.text : "transparent", borderRadius: 12, padding: "0 12px", margin: "0 -2px", boxDecorationBreak: "clone", textShadow: on ? "none" : undefined }}>
              {w.text}
            </span>
          );
        })}
      </p>
    </div>
  );
}

/** Line 1 as large on-screen text from the first frame, the word being said highlighted. */
function BigLine({ words }: { words: ReelWord[] }) {
  const t = useCurrentFrame() / FPS;
  return (
    <div style={{ position: "absolute", left: 64, right: 64, top: 290 }}>
      <p style={{ margin: 0, fontFamily: sans, fontWeight: 900, fontSize: 104, lineHeight: 0.98, letterSpacing: "-0.045em", textShadow: "0 6px 32px rgba(0,0,0,.8)" }}>
        {words.map((w, i) => {
          const on = t >= w.start - 0.03 && t < (words[i + 1]?.start ?? Infinity);
          return (
            <span key={i}>
              <span style={{ color: on ? C.bg : C.text, background: on ? C.text : "transparent", borderRadius: 14, padding: "0 10px", margin: "0 -10px", boxDecorationBreak: "clone" }}>{w.text}</span>{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}

/** Line 4: each question as a big card, from the moment it's said. */
function QuestionCards({ words, duration }: { words: ReelWord[]; duration: number }) {
  const t = useCurrentFrame() / FPS;
  let after = 0;
  const starts = REEL_QUESTIONS.map((q) => {
    const s = wordAt(words, q.split(" ")[0], after) ?? after;
    after = s + 0.1;
    return s;
  });
  const i = starts.findLastIndex((s) => t >= s - 0.05);
  if (i < 0) return null;
  const until = starts[i + 1] ?? duration;
  return (
    <Sequence key={i} from={Math.round(starts[i] * FPS) - 1} layout="none">
      <Card text={REEL_QUESTIONS[i]} end={Math.round((until - starts[i]) * FPS) + 2} />
    </Sequence>
  );
}
function Card({ text, end }: { text: string; end: number }) {
  const { opacity, y } = useEnter(0, 5, end + 6, 1);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 300, opacity, transform: `translateY(${y}px)` }}>
      <p style={{ margin: 0, fontFamily: sans, fontWeight: 900, fontSize: 104, lineHeight: 0.98, letterSpacing: "-0.045em", color: C.text, background: "rgba(10,10,11,0.94)", border: `3px solid ${C.borderStrong}`, borderRadius: 28, padding: "40px 44px 48px" }}>
        {text}
      </p>
    </div>
  );
}

/** Line 6: the product, cut to the words: the repo pasted, the scan, the grilling. */
function ProductRun({ words, demo, duration }: { words: ReelWord[]; demo: Plan; duration: number }) {
  const f = useCurrentFrame();
  const t = f / FPS;
  const scenes = demo.scenes.filter((s): s is Extract<Plan["scenes"][number], { kind: "capture" }> => s.kind === "capture");
  const [land, scan, grill] = scenes;
  const scanAt = wordAt(words, "it") ?? duration * 0.25;
  const grillAt = wordAt(words, "then", scanAt) ?? duration * 0.55;
  let take = land;
  let local = f;
  if (t >= grillAt) {
    take = grill;
    local = f - Math.round(grillAt * FPS);
  } else if (t >= scanAt) {
    take = scan;
    // Straight to the claims being checked and the drop.
    local = f - Math.round(scanAt * FPS) + Math.max(0, scan.duration - Math.round((grillAt - scanAt) * FPS) - 20);
  } else local = f + Math.max(0, land.duration - Math.round(scanAt * FPS));
  return <CaptureFrame aspect="9x16" take={take.take} frame={take.from + Math.min(local, take.duration - 1)} y={take.shift} />;
}

/** Line 8: the last answer lands and the odds roll down to 34%. */
function OddsRun({ demo, frames }: { demo: Plan; frames: number }) {
  const f = useCurrentFrame();
  const grill = demo.scenes.filter((s) => s.kind === "capture")[2] as Extract<Plan["scenes"][number], { kind: "capture" }>;
  const at = demo.answerDrop;
  const from = at - Math.round(frames * 0.35);
  return <CaptureFrame aspect="9x16" take="demo" frame={from + f} y={grill.shift} />;
}

/** Line 7: you on top, the judge you name below at 4x, crisp. */
function SplitJudges({ src, words }: { src: string; words: ReelWord[] }) {
  const t = useCurrentFrame() / FPS;
  const inv = wordAt(words, "akshat's") ?? wordAt(words, "investor") ?? Infinity;
  const krish = wordAt(words, "krish", inv === Infinity ? 0 : inv) ?? Infinity;
  const tired = wordAt(words, "tired", krish === Infinity ? 0 : krish) ?? Infinity;
  let judge: Judge = "engineer";
  let frame = "base";
  let name = "the engineer";
  if (t >= inv - 0.05) {
    judge = "investor";
    name = "the investor";
  }
  if (t >= krish - 0.05) {
    judge = "tired";
    name = "the tired judge";
  }
  if (t >= tired - 0.05) frame = "dozing";
  else if (judge === "tired" && t >= krish + 0.6) frame = "sip";
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 960, overflow: "hidden" }}>
        <OffthreadVideo src={staticFile(src)} style={{ position: "absolute", width: 1080, height: 1920, top: -360 }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 960, height: 4, background: C.borderStrong }} />
      <div style={{ position: "absolute", left: (1080 - 512) / 2, top: 1000 }}>
        <div style={{ border: `4px solid ${C.borderStrong}`, borderRadius: 24, overflow: "hidden" }}>
          <Sprite judge={judge} frame={frame} scale={4} />
        </div>
        <p style={{ margin: "18px 0 0", fontFamily: mono, fontSize: 34, color: C.subtle, textAlign: "center" }}>{name}</p>
      </div>
    </AbsoluteFill>
  );
}

/** Line 9: the face, then the end card on "would yours win?". */
function FaceThenEnd({ src, words, duration }: { src: string; words: ReelWord[]; duration: number }) {
  const f = useCurrentFrame();
  const cut = wordAt(words, "would") ?? Infinity;
  const at = Math.round(cut * FPS);
  return (
    <>
      {/* The clip stops at its last frame; the end card holds on after it. */}
      <Sequence durationInFrames={Math.round(duration * FPS)} layout="none">
        <Face src={src} />
      </Sequence>
      {f >= at && (
        <Sequence from={at} layout="none">
          <EndCard aspect="9x16" />
        </Sequence>
      )}
    </>
  );
}

const CAPTION_TOP = 1290;

function Line({ line, demo, frames }: { line: ReelLineTake; demo: Plan | null; frames: number }) {
  const w = line.words;
  switch (line.layout) {
    case "face":
      return (
        <AbsoluteFill>
          <Face src={line.src} />
          {line.id === 1 ? <BigLine words={w} /> : <Words words={w} top={CAPTION_TOP} />}
        </AbsoluteFill>
      );
    case "face-cards":
      return (
        <AbsoluteFill>
          <Face src={line.src} />
          <QuestionCards words={w} duration={line.duration} />
          <Words words={w} top={CAPTION_TOP} />
        </AbsoluteFill>
      );
    case "product-circle":
      return (
        <AbsoluteFill style={{ background: C.bg }}>
          {/* The voice, from the clip; the picture is the product. */}
          <Audio src={staticFile(line.src)} />
          {demo && <ProductRun words={w} demo={demo} duration={line.duration} />}
          <FaceCircle src={line.src} />
          <Words words={w} top={CAPTION_TOP + 125} />
        </AbsoluteFill>
      );
    case "odds-circle":
      return (
        <AbsoluteFill style={{ background: C.bg }}>
          <Audio src={staticFile(line.src)} />
          {demo && <OddsRun demo={demo} frames={frames} />}
          <FaceCircle src={line.src} />
          <Words words={w} top={CAPTION_TOP + 125} />
        </AbsoluteFill>
      );
    case "split-judges":
      return (
        <AbsoluteFill>
          <SplitJudges src={line.src} words={w} />
          <Words words={w} top={820} />
        </AbsoluteFill>
      );
    case "face-endcard":
      return (
        <AbsoluteFill>
          <FaceThenEnd src={line.src} words={w} duration={line.duration} />
          <Words words={w} top={CAPTION_TOP} skip={false} />
        </AbsoluteFill>
      );
  }
}

/** A quiet bed under the voice: in and out with a fade. */
function Music({ duration }: { duration: number }) {
  return (
    <Audio
      src={staticFile("audio/music.mp3")}
      volume={(f) => Math.min(interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" }), interpolate(f, [duration - 45, duration], [1, 0], { extrapolateLeft: "clamp" })) * 0.09}
    />
  );
}

export function ReelFace({ takes, music, demo }: ReelProps) {
  if (!takes) {
    return (
      <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: mono, color: C.subtle, fontSize: 36 }}>no takes yet: run npm run reel</p>
      </AbsoluteFill>
    );
  }
  let at = 0;
  const total = takes.lines.reduce((n, l, i) => n + framesOf(l, i === takes.lines.length - 1), 0);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {takes.lines.map((line, i) => {
        const frames = framesOf(line, i === takes.lines.length - 1);
        const from = at;
        at += frames;
        return (
          <Sequence key={line.id} from={from} durationInFrames={frames}>
            <Line line={line} demo={demo} frames={frames} />
          </Sequence>
        );
      })}
      {music && <Music duration={total} />}
    </AbsoluteFill>
  );
}
