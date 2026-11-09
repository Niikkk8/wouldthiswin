// The launch video's design kit: the site's tokens and fonts, motion helpers, texture, and
// the pieces every scene shares. Easing/spring helpers, Mask and Grain are adapted from
// claude-motion (MIT, github.com/whaleyxbt/claude-motion, src/lib.ts + src/components).

import React from "react";
import { AbsoluteFill, Easing, spring, type SpringConfig, staticFile, useVideoConfig } from "remotion";
import { FRAMES, HEAD_CROP, SPRITE_SIZE, frameIndex } from "../../../lib/judge-sprites";
import { mono, sans } from "../theme";
import { LOGO_PARTS, LOGO_VIEWBOX } from "./logo-paths";

// ---------------------------------------------------------------- tokens (app/globals.css)

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
} as const;

export const F = { display: sans, mono };

export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** Instagram's own UI covers these on a 1080x1920 Reel. Nothing that matters goes there. */
export const SAFE = { top: 250, bottom: 420, right: 140, left: 72 } as const;
/** The content column inside the safe zone. */
export const COL = { x: SAFE.left, w: W - SAFE.left - SAFE.right - 16 } as const; // 72..924, 852 wide

// ---------------------------------------------------------------- motion helpers

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.6, 0, 0.9, 0.35);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
/** 0..1 over [t0, t1] seconds with an easing. */
export const prog = (t: number, t0: number, t1: number, ease: (x: number) => number = easeInOut) => ease(clamp01((t - t0) / (t1 - t0)));
/** A spring starting at `startSec`. Defaults: fast in, gentle settle. */
export const sp = (frame: number, startSec: number, config: Partial<SpringConfig> = {}) => {
  const fr = frame - startSec * FPS;
  if (fr <= 0) return 0;
  return spring({ frame: fr, fps: FPS, config: { damping: 14, mass: 0.8, stiffness: 140, ...config } });
};
/** Deterministic pseudo-random in [0, 1). */
export const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------- texture

/** The page: background, a dot grid drifting a few px a second, a glow that carries state, a vignette. */
export function Backdrop({ t, glow = 0, tone = "loss", glowX = 50, glowY = 42 }: { t: number; glow?: number; tone?: "loss" | "gain" | "neutral"; glowX?: number; glowY?: number }) {
  const rgb = tone === "loss" ? "255,59,48" : tone === "gain" ? "77,124,255" : "244,244,242";
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 42% at ${glowX}% ${glowY}%, rgba(${rgb},${0.05 + 0.2 * glow}) 0%, rgba(${rgb},0) 70%)` }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${-t * 3} ${-t * 6})`}>
            <circle cx="20" cy="20" r="1.4" fill="rgba(244,244,242,0.09)" />
          </pattern>
          <radialGradient id="dotfade" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="dotmask">
            <rect width={W} height={H} fill="url(#dotfade)" />
          </mask>
        </defs>
        <rect width={W} height={H} fill="url(#dots)" mask="url(#dotmask)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 75% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
}

/** Film grain, reseeded on twos. */
export function Grain({ frame, opacity = 0.07 }: { frame: number; opacity?: number }) {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity }}>
      <svg width={width} height={height}>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={Math.floor(frame / 2) % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}

/** Masked reveal: k 0→1 slides the content up into its clip; `out` slides it up and away. */
export function Mask({ k, out = 0, tilt = 4, children, style }: { k: number; out?: number; tilt?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", padding: "0.08em 0.06em 0.18em", margin: "-0.08em -0.06em -0.18em" }}>
      <span style={{ display: "inline-block", transform: `translateY(${(1 - k - out) * 118}%) rotate(${(1 - k) * tilt}deg)`, transformOrigin: "0% 100%", ...style }}>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------- the judges

export type Judge = keyof typeof FRAMES;
export const JUDGES: Judge[] = ["engineer", "investor", "tired"];
export const JUDGE_NAME: Record<Judge, string> = { engineer: "the engineer", investor: "the investor", tired: "the tired judge" };

/**
 * A judge from their sprite sheet. The scale is always a whole number (a fractional one
 * is rounded) and the position snaps to whole pixels, so every art pixel is a crisp square.
 */
export function Sprite({ judge, frame = "base", scale, style }: { judge: Judge; frame?: string; scale: number; style?: React.CSSProperties }) {
  const s = Math.max(1, Math.round(scale));
  const size = SPRITE_SIZE * s;
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
        ...style,
      }}
    />
  );
}

/** A judge in the app's bordered window. */
export function JudgeCard({ judge, frame, scale, dim = 0, style }: { judge: Judge; frame?: string; scale: number; dim?: number; style?: React.CSSProperties }) {
  const s = Math.max(1, Math.round(scale));
  return (
    <div
      style={{
        border: `${Math.min(3, s)}px solid ${C.borderStrong}`,
        borderRadius: 10 + 4 * s,
        overflow: "hidden",
        background: C.bg,
        opacity: 1 - 0.55 * dim,
        filter: dim ? `blur(${(dim * 3).toFixed(2)}px)` : undefined,
        ...style,
      }}
    >
      <Sprite judge={judge} frame={frame} scale={s} />
    </div>
  );
}

/** The judge's head: the base frame's face crop, at a whole-number scale, in a circle. */
export function Head({ judge, scale = 1 }: { judge: Judge; scale?: number }) {
  const s = Math.max(1, Math.round(scale));
  const crop = HEAD_CROP[judge];
  const size = crop.size * s;
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        backgroundColor: C.bg,
        backgroundImage: `url(${staticFile(`judges/${judge}-sheet.png`)})`,
        backgroundSize: `${FRAMES[judge].length * SPRITE_SIZE * s}px ${SPRITE_SIZE * s}px`,
        backgroundPosition: `${-crop.x * s}px ${-crop.y * s}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

// ---------------------------------------------------------------- the mark

/** The {?} mark from brand/logo.svg. `parts` can move each actor independently. */
export function Logo({ height, parts = {} }: { height: number; parts?: Partial<Record<(typeof LOGO_PARTS)[number]["id"], React.CSSProperties>> }) {
  const w = (LOGO_VIEWBOX.width / LOGO_VIEWBOX.height) * height;
  return (
    <svg width={w} height={height} viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`} style={{ overflow: "visible", display: "block" }}>
      {LOGO_PARTS.map((p) => (
        <path key={p.id} d={p.d} fill={p.fill} style={{ transformBox: "fill-box", transformOrigin: "center", ...parts[p.id] }} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- type

export const label: React.CSSProperties = { fontFamily: F.mono, fontSize: 30, letterSpacing: "0.08em", textTransform: "uppercase", color: C.subtle };

/** Instagram's overlay zones, for previews only: never in an export. */
export function SafeZones() {
  const band = (s: React.CSSProperties, text: string) => (
    <div style={{ position: "absolute", background: "rgba(255, 0, 140, 0.22)", border: "2px dashed rgba(255,0,140,0.9)", display: "flex", alignItems: "center", justifyContent: "center", ...s }}>
      <span style={{ fontFamily: F.mono, fontSize: 26, color: "#ff4fb3", background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 6 }}>{text}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {band({ left: 0, right: 0, top: 0, height: SAFE.top }, "instagram ui: top 250")}
      {band({ left: 0, right: 0, bottom: 0, height: SAFE.bottom }, "instagram ui: bottom 420")}
      {band({ right: 0, top: SAFE.top, bottom: SAFE.bottom, width: SAFE.right, writingMode: "vertical-rl" }, "right 140")}
    </AbsoluteFill>
  );
}
