import { Composition, Folder } from "remotion";
import { Edit, durationOf, FPS, type Spec } from "./edit";
import edits from "./edits.json";

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

