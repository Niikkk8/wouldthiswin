import { Composition, Folder, Still } from "remotion";
import { StyleFrame } from "./v2/StyleFrame";
import { ReelV3, V3 } from "./v3/Root";
import { LaunchV2, LogoContract } from "./v2/Launch";
import v2timeline from "./v2/timeline.json";
import type { Plan } from "../scripts/plan";
import { Launch, type LaunchProps } from "./Launch";
import plans from "./plan.json";
import { ReelFace, reelMetadata, type ReelProps } from "./ReelFace";
import { FPS, SIZE, type Aspect } from "./theme";

const all = plans as unknown as Partial<Record<Aspect, Plan>>;

export function Root() {
  return (
    <>
      <V3 />
      <ReelV3 />
      <Folder name="v2">
        <Composition id="launch-v2-9x16" component={LaunchV2} fps={30} width={1080} height={1920} durationInFrames={v2timeline.frames} defaultProps={{ aspect: "9x16", safeZones: false }} />
        <Composition id="launch-v2-9x16-safe" component={LaunchV2} fps={30} width={1080} height={1920} durationInFrames={v2timeline.frames} defaultProps={{ aspect: "9x16", safeZones: true }} />
        <Composition id="launch-v2-16x9" component={LaunchV2} fps={30} width={1920} height={1080} durationInFrames={v2timeline.frames} defaultProps={{ aspect: "16x9", safeZones: false }} />
      </Folder>
      <Folder name="v2-brand">
        <Still id="logo-contract-animated" component={LogoContract} width={800} height={600} defaultProps={{ mode: "animated" }} />
        <Still id="logo-contract-static" component={LogoContract} width={800} height={600} defaultProps={{ mode: "static" }} />
      </Folder>
      <Folder name="v2-style-frames">
        <Still id="sf-1a" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "1a", safeZones: true }} />
        <Still id="sf-1b" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "1b", safeZones: true }} />
        <Still id="sf-2" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "2", safeZones: true }} />
        <Still id="sf-3a" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "3a", safeZones: true }} />
        <Still id="sf-3b" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "3b", safeZones: true }} />
        <Still id="sf-4" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "4", safeZones: true }} />
        <Still id="sf-5" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "5", safeZones: true }} />
        <Still id="sf-6" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "6", safeZones: true }} />
        <Still id="sf-7" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "7", safeZones: true }} />
        <Still id="sf-8" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "8", safeZones: true }} />
        <Still id="sf-9" component={StyleFrame} width={1080} height={1920} defaultProps={{ scene: "9", safeZones: true }} />
      </Folder>
      {(["16x9", "9x16"] as const).map((aspect) => {
        const plan = all[aspect];
        if (!plan) return null;
        return (
          <Composition
            key={aspect}
            id={`launch-${aspect}`}
            component={Launch}
            fps={FPS}
            durationInFrames={plan.duration}
            {...SIZE[aspect]}
            defaultProps={{ aspect, plan, music: false }}
          />
        );
      })}
      <Composition
        id="reel-face-9x16"
        component={ReelFace}
        fps={FPS}
        durationInFrames={300}
        {...SIZE["9x16"]}
        defaultProps={{ takes: null, music: false, demo: all["9x16"] ?? null }}
        calculateMetadata={reelMetadata}
      />
    </>
  );
}
