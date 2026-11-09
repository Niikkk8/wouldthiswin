import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { JudgeRow, useEnter } from "../parts";
import { C, mono, sans, type Aspect } from "../theme";

const big = (aspect: Aspect) => aspect === "9x16";

function Brand({ aspect }: { aspect: Aspect }) {
  const s = big(aspect) ? 2 : 1.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 * s }}>
      <Img src={staticFile("logo.png")} style={{ width: 28 * s, height: 28 * s }} />
      <span style={{ fontFamily: sans, fontWeight: 800, fontSize: 20 * s, color: C.text, letterSpacing: "-0.02em" }}>wouldthiswin</span>
    </div>
  );
}

const headline = (aspect: Aspect, size: number): React.CSSProperties => ({
  margin: 0,
  fontFamily: sans,
  fontWeight: 900,
  fontSize: size,
  lineHeight: 0.92,
  letterSpacing: "-0.05em",
  color: C.text,
  textWrap: "balance",
  textAlign: big(aspect) ? "left" : "left",
});

/**
 * Scenes 1 and 2: the hook, then the question. The hook is on screen, full size, from the
 * very first frame (it's the thumbnail); the judges blink underneath.
 */
export function Hook({ aspect, swapAt }: { aspect: Aspect; swapAt: number }) {
  const f = useCurrentFrame();
  const tall = big(aspect);
  const hookOut = interpolate(f, [swapAt - 5, swapAt], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const q = useEnter(swapAt, 9);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", left: tall ? 72 : 160, top: tall ? 250 : 120 }}>
        <Brand aspect={aspect} />
      </div>
      <div style={{ position: "absolute", left: tall ? 72 : 160, right: tall ? 72 : 160, top: tall ? 400 : 250 }}>
        {f < swapAt && (
          <p style={{ ...headline(aspect, tall ? 108 : 100), opacity: hookOut }}>
            the night before submission, every team asks one question
          </p>
        )}
        {f >= swapAt - 1 && (
          <p style={{ ...headline(aspect, tall ? 190 : 200), opacity: q.opacity, transform: `translateY(${q.y}px)` }}>
            would this win?
          </p>
        )}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: tall ? 1150 : 660 }}>
        <JudgeRow scale={2} gap={tall ? 24 : 40} />
      </div>
    </AbsoluteFill>
  );
}

/** Scene 9: the end card. */
export function EndCard({ aspect }: { aspect: Aspect }) {
  const tall = big(aspect);
  const a = useEnter(0, 9);
  const b = useEnter(8, 9);
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center" }}>
      <div style={{ position: "absolute", top: tall ? 330 : 120, left: 0, right: 0 }}>
        <JudgeRow scale={2} gap={tall ? 24 : 40} offset={60} />
      </div>
      <div style={{ position: "absolute", top: tall ? 760 : 520, left: 0, right: 0, textAlign: "center" }}>
        <p style={{ ...headline(aspect, tall ? 116 : 136), textAlign: "center", opacity: a.opacity, transform: `translateY(${a.y}px)` }}>
          wouldthiswin.com
        </p>
        <p
          style={{
            margin: tall ? "44px 0 0" : "36px 0 0",
            fontFamily: mono,
            fontSize: tall ? 44 : 40,
            color: C.muted,
            opacity: b.opacity,
            transform: `translateY(${b.y}px)`,
          }}
        >
          free. no sign-up.
        </p>
      </div>
    </AbsoluteFill>
  );
}
