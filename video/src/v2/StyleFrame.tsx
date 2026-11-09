import { AbsoluteFill } from "remotion";
import { Backdrop, Grain, SafeZones } from "./kit";
import { PanelRow, S2Caption, S1Hook, S1Slam, S2Repo, S3Odds, S3Scan, S4Panel, S5Answer, S6Tired, S7Chat, S8Review, S9End } from "./scenes";

export type StyleScene = "1a" | "1b" | "2" | "3a" | "3b" | "4" | "5" | "6" | "7" | "8" | "9";
export type StyleFrameProps = { scene: StyleScene; safeZones: boolean };

/** How each scene's backdrop glows: the light carries the story (red = trouble, blue = a gain). */
const LOOK: Record<StyleScene, { glow: number; tone: "loss" | "gain" | "neutral"; glowY?: number }> = {
  "1a": { glow: 0.15, tone: "neutral" },
  "1b": { glow: 0.55, tone: "loss", glowY: 50 },
  "2": { glow: 0.2, tone: "neutral", glowY: 55 },
  "3a": { glow: 0.45, tone: "loss", glowY: 62 },
  "3b": { glow: 0.9, tone: "loss" },
  "4": { glow: 0.25, tone: "neutral", glowY: 30 },
  "5": { glow: 0.5, tone: "gain", glowY: 25 },
  "6": { glow: 0.12, tone: "neutral", glowY: 32 },
  "7": { glow: 0.18, tone: "neutral" },
  "8": { glow: 0.35, tone: "loss", glowY: 30 },
  "9": { glow: 0.3, tone: "loss", glowY: 42 },
};

export function StyleFrame({ scene, safeZones }: StyleFrameProps) {
  const look = LOOK[scene];
  return (
    <AbsoluteFill>
      <Backdrop t={2} glow={look.glow} tone={look.tone} glowY={look.glowY} />
      {scene === "1a" && (
        <>
          <S1Hook />
          <PanelRow top={1186} dim={0.45} />
        </>
      )}
      {scene === "1b" && (
        <>
          <S1Slam />
          <PanelRow top={1186} dim={0} frames={{ engineer: "skeptical", investor: "eyebrow", tired: "perked" }} />
        </>
      )}
      {scene === "2" && (
        <>
          <S2Repo />
          <S2Caption />
        </>
      )}
      {scene === "3a" && <S3Scan />}
      {scene === "3b" && <S3Odds />}
      {scene === "4" && <S4Panel />}
      {scene === "5" && <S5Answer />}
      {scene === "6" && <S6Tired />}
      {scene === "7" && <S7Chat />}
      {scene === "8" && <S8Review />}
      {scene === "9" && <S9End />}
      <Grain frame={4} />
      {safeZones && <SafeZones />}
    </AbsoluteFill>
  );
}
