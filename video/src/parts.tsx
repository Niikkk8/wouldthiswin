import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
// The app's own frame table, so the video's judges use the same sheets the same way.
import { FRAMES, SPRITE_SIZE, frameIndex } from "../../lib/judge-sprites";
import { C, EASE, sans, type Aspect } from "./theme";

export type Judge = keyof typeof FRAMES;
export const JUDGES: Judge[] = ["engineer", "investor", "tired"];

const ease = Easing.bezier(...EASE);

/**
 * One judge from their sprite sheet at a whole-number scale, nearest neighbour: every art
 * pixel is exactly `scale` by `scale` output pixels.
 */
export function Sprite({ judge, frame = "base", scale }: { judge: Judge; frame?: string; scale: 1 | 2 | 3 | 4 }) {
  const size = SPRITE_SIZE * scale;
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${staticFile(`judges/${judge}-sheet.png`)})`,
        backgroundSize: `${FRAMES[judge].length * size}px ${size}px`,
        backgroundPosition: `${-frameIndex(judge, frame) * size}px 0`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
    />
  );
}

/** Blinks on a fixed schedule (4 frames, about the app's 120ms), different for each judge. */
const BLINKS: Record<Judge, number[]> = {
  engineer: [38, 150, 262],
  investor: [72, 190, 300],
  tired: [18, 118, 236],
};
export function BlinkingJudge({ judge, scale, offset = 0 }: { judge: Judge; scale: 1 | 2 | 3 | 4; offset?: number }) {
  const f = useCurrentFrame() + offset;
  const blink = BLINKS[judge].some((b) => f >= b && f < b + 4);
  return <Sprite judge={judge} scale={scale} frame={blink ? "blink" : "base"} />;
}

/** The judges in their bordered windows, as the app draws them. */
export function JudgeRow({ scale, gap, offset = 0 }: { scale: 1 | 2 | 3 | 4; gap: number; offset?: number }) {
  return (
    <div style={{ display: "flex", gap, justifyContent: "center" }}>
      {JUDGES.map((j) => (
        <div key={j} style={{ border: `${scale}px solid ${C.borderStrong}`, borderRadius: 12 * scale, overflow: "hidden", background: C.bg }}>
          <BlinkingJudge judge={j} scale={scale} offset={offset} />
        </div>
      ))}
    </div>
  );
}

/** One captured frame of the real app, at its native size (no scaling, ever). */
export function CaptureFrame({ aspect, take, frame, y = 0 }: { aspect: Aspect; take: string; frame: number; y?: number }) {
  return (
    <Img
      src={staticFile(`capture/${aspect}/${take}/${String(frame).padStart(5, "0")}.png`)}
      style={{ position: "absolute", left: 0, top: Math.round(y), imageRendering: "pixelated" }}
    />
  );
}

/** Rises and fades in over `dur` frames from `at`, and out over the last `out` frames before `end`. */
export function useEnter(at: number, dur = 8, end?: number, out = 6) {
  const f = useCurrentFrame();
  const inP = interpolate(f, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const outP = end === undefined ? 1 : interpolate(f, [end - out, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity: inP * outP, y: (1 - inP) * 18 };
}

/** The storyboard's captions: lowercase, the app's type, large, on a solid chip so they read over anything. */
export function Caption({ text, aspect, top, end }: { text: string; aspect: Aspect; top: number; end: number }) {
  const { opacity, y } = useEnter(0, 8, end, 6);
  const big = aspect === "9x16";
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${y}px)`,
        padding: big ? "0 64px" : "0 240px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: sans,
          fontWeight: 800,
          fontSize: big ? 62 : 50,
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          color: C.text,
          background: "rgba(10,10,11,0.94)",
          border: `2px solid ${C.borderStrong}`,
          borderRadius: 18,
          padding: big ? "18px 30px 22px" : "14px 28px 18px",
          textAlign: "center",
          textWrap: "balance",
        }}
      >
        {text}
      </p>
    </div>
  );
}
