import { Composition, Folder } from "remotion";
import { Edit, durationOf, FPS, type Spec } from "./edit";
import edits from "./edits.json";
import { Reel, type ReelProps } from "../reel/Reel";

const all = edits as unknown as Record<string, Spec>;

/** One composition per entry in edits.json. */
export function V3() {
  return (
    <Folder name="v3">
      {Object.entries(all).map(([id, spec]) => (
        <Composition key={id} id={id} component={Edit} fps={FPS} width={spec.width} height={spec.height} durationInFrames={Math.max(1, durationOf(spec))} defaultProps={{ spec }} />
      ))}
    </Folder>
  );
}

/** The face reel: props come from scripts/reel-v3.ts (the plan), duration from the plan. */
export function ReelV3() {
  const meta = ({ props }: { props: ReelProps }) => ({ durationInFrames: Math.max(30, Math.round((props.plan?.duration ?? 1) * FPS)) });
  return (
    <Folder name="reel">
      <Composition id="reel-9x16" component={Reel} fps={FPS} width={1080} height={1920} durationInFrames={30} defaultProps={{ plan: null } as ReelProps} calculateMetadata={meta} />
      <Composition id="reel-4x5" component={Reel} fps={FPS} width={1080} height={1350} durationInFrames={30} defaultProps={{ plan: null } as ReelProps} calculateMetadata={meta} />
    </Folder>
  );
}
