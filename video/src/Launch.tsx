import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Plan, Scene } from "../scripts/plan";
import { CaptureFrame, Caption } from "./parts";
import { EndCard, Hook } from "./scenes/cards";
import { C, type Aspect } from "./theme";

export type LaunchProps = { aspect: Aspect; plan: Plan; music: boolean };

function CaptureScene({ aspect, scene }: { aspect: Aspect; scene: Extract<Scene, { kind: "capture" }> }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <CaptureFrame aspect={aspect} take={scene.take} frame={scene.from + f} y={scene.shift} />
      {scene.caption && (
        <Sequence from={scene.caption.at ?? 6} layout="none">
          <Caption aspect={aspect} text={scene.caption.text} top={scene.caption.top} end={scene.duration - (scene.caption.at ?? 6)} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

const CLICKS = ["click-0", "click-1", "click-2", "click-3"];
/** Every effect, 6 dB down from the cue levels, so they sit clearly under the music. */
const SFX_GAIN = 0.5;

/** The quiet bed: fades in and out, and dips under the key sounds. */
function Music({ duration, keys }: { duration: number; keys: number[] }) {
  return (
    <Audio
      src={staticFile("audio/music.mp3")}
      volume={(f) => {
        const fade = Math.min(interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" }), interpolate(f, [duration - 45, duration], [1, 0], { extrapolateLeft: "clamp" }));
        const near = keys.some((k) => f >= k - 6 && f <= k + 24);
        return fade * (near ? 0.09 : 0.22);
      }}
    />
  );
}

export function Launch({ aspect, plan, music }: LaunchProps) {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {plan.scenes.map((s, i) => {
        const from = at;
        at += s.duration;
        return (
          <Sequence key={i} from={from} durationInFrames={s.duration}>
            {s.kind === "hook" && <Hook aspect={aspect} swapAt={s.swapAt} />}
            {s.kind === "end" && <EndCard aspect={aspect} />}
            {s.kind === "capture" && <CaptureScene aspect={aspect} scene={s} />}
          </Sequence>
        );
      })}
      {plan.cues.map((c, i) => (
        <Sequence key={`sfx-${i}`} from={c.f} layout="none">
          <Audio src={staticFile(`sfx/${c.sfx === "click" ? CLICKS[i % CLICKS.length] : c.sfx}.wav`)} volume={c.volume * SFX_GAIN} />
        </Sequence>
      ))}
      {music && <Music duration={plan.duration} keys={plan.key} />}
    </AbsoluteFill>
  );
}
