// The site's tokens (app/globals.css) and fonts (Archivo, JetBrains Mono), for the video.
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const sans = loadArchivo("normal", { weights: ["400", "700", "800", "900"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

export const C = {
  bg: "#0a0a0b",
  surface: "#141416",
  surface2: "#1c1c1f",
  border: "#222225",
  borderStrong: "#3a3a3e",
  text: "#f4f4f2",
  muted: "#b5b5b8",
  subtle: "#8a8a8e",
  gain: "#4d7cff",
  loss: "#ff3b30",
  unclear: "#f5a524",
};

export const EASE = [0.22, 1, 0.36, 1] as const;

export type Aspect = "9x16" | "16x9";
export const SIZE: Record<Aspect, { width: number; height: number }> = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
};
export const FPS = 30;
