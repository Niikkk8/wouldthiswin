// Real app footage (scripts/capture-v3.ts) with a camera that lands on named elements.
//
// Each capture has a meta file: per frame, the rect of every element that matters (odds,
// the caught phrase, the answer box, each judge, each fix). A shot names a target and how
// much of the frame it should fill; the camera reads the target's rect at the current source
// frame, so it lands on the element exactly and follows it if the page scrolls.

import React, { useCallback, useEffect, useState } from "react";
import { OffthreadVideo, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { easeInOut, easeOut, clamp01 } from "../v2/kit";

export type Rect = [number, number, number, number];
type Meta = { fps: number; dpr: number; frames: { f: number; rects: Record<string, Rect>; odds: string | null; answer: number; chat: number; typed: number }[] };

const cache = new Map<string, Meta>();
const pending = new Map<string, Promise<Meta>>();

/** The capture's per-frame meta, loaded once (render waits for it). */
export function useMeta(clip: string): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(() => cache.get(clip) ?? null);
  const [handle] = useState(() => (cache.has(clip) ? null : delayRender(`meta ${clip}`)));
  useEffect(() => {
    if (meta) return;
    let p = pending.get(clip);
    if (!p) {
      p = fetch(staticFile(`capture/v3/${clip}.json`)).then((r) => r.json());
      pending.set(clip, p);
    }
    p.then((m) => {
      cache.set(clip, m);
      setMeta(m);
      if (handle !== null) continueRender(handle);
    });
  }, [clip, meta, handle]);
  return meta;
}

/** The target's rect at source frame f, or the nearest frame that has it. */
export function rectAt(meta: Meta, name: string, f: number): Rect | null {
  const n = meta.frames.length;
  const i0 = Math.max(0, Math.min(n - 1, Math.round(f)));
  for (let d = 0; d < n; d++) {
    for (const i of [i0 - d, i0 + d]) {
      const r = i >= 0 && i < n ? meta.frames[i].rects[name] : undefined;
      if (r) return r;
    }
  }
  return null;
}

/** A camera keyframe: at `at` seconds into the shot, `target` fills `fill` of the frame width, its centre at (ax, ay). */
export type Cam = {
  at: number;
  target: string | Rect | [string, string];
  fill?: number;
  /** Fit by height instead (fraction of frame height). */
  fillH?: number;
  ax?: number;
  ay?: number;
  /** Seconds to move from the previous keyframe; 0 is a cut. */
  move?: number;
  ease?: "inOut" | "out";
  /** Dim everything outside the target (plus this padding, in source px), like a spotlight. */
  isolate?: number;
};

const MAX_SCALE = 2.6;
/** Device-pixel size of each capture (scripts/capture-v3.ts ASPECTS). */
export const SOURCE = { "16x9": { width: 2560, height: 1800 }, "9x16": { width: 1620, height: 2880 } } as const;

function pose(meta: Meta, k: Cam, f: number, W: number, H: number) {
  let r: Rect | null;
  if (typeof k.target === "string") r = rectAt(meta, k.target, f);
  else if (typeof k.target[0] === "string") {
    const a = rectAt(meta, k.target[0] as string, f);
    const b = rectAt(meta, k.target[1] as string, f);
    r = a && b ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0] + a[2], b[0] + b[2]) - Math.min(a[0], b[0]), Math.max(a[1] + a[3], b[1] + b[3]) - Math.min(a[1], b[1])] : (a ?? b);
  } else r = k.target as Rect;
  if (!r) r = [0, 0, 2560, 1440];
  let s = k.fillH ? (k.fillH * H) / r[3] : ((k.fill ?? 0.8) * W) / r[2];
  if (k.fill && k.fillH) s = Math.min((k.fill * W) / r[2], (k.fillH * H) / r[3]);
  s = Math.min(MAX_SCALE, s);
  return { cx: r[0] + r[2] / 2, cy: r[1] + r[3] / 2, s, ax: (k.ax ?? 0.5) * W, ay: (k.ay ?? 0.5) * H, r };
}

/**
 * One shot of footage: source seconds `from` onwards at `rate`, framed by `cams`. Between
 * keyframes the camera eases from one pose to the next (both poses track their targets).
 * `shake` (0..1) jolts it on the frame it starts, decaying over 0.35 s.
 */
export function Footage({ clip, from, rate = 1, cams, shakeAt, box }: { clip: string; from: number; rate?: number; cams: Cam[]; shakeAt?: number[]; box?: { w: number; h: number } }) {
  const frame = useCurrentFrame();
  const vc = useVideoConfig();
  const fps = vc.fps;
  const W = box?.w ?? vc.width;
  const H = box?.h ?? vc.height;
  const meta = useMeta(clip);
  const t = frame / fps;
  const srcF = (from + t * rate) * 30;

  const camera = useCallback((): { transform: string; spot: React.CSSProperties | null } => {
    if (!meta) return { transform: "none", spot: null };
    let i = 0;
    while (i + 1 < cams.length && cams[i + 1].at <= t) i++;
    const cur = pose(meta, cams[i], srcF, W, H);
    let p = cur;
    const next = cams[i + 1];
    // A move into the next keyframe starts `move` seconds before it.
    if (next && (next.move ?? 0.6) > 0 && t > next.at - (next.move ?? 0.6)) {
      const k = clamp01((t - (next.at - (next.move ?? 0.6))) / (next.move ?? 0.6));
      const e = (next.ease === "out" ? easeOut : easeInOut)(k);
      const nx = pose(meta, next, srcF, W, H);
      // Interpolate in log-scale so zooms feel even.
      const s = Math.exp(Math.log(cur.s) + (Math.log(nx.s) - Math.log(cur.s)) * e);
      p = { cx: cur.cx + (nx.cx - cur.cx) * e, cy: cur.cy + (nx.cy - cur.cy) * e, s, ax: cur.ax + (nx.ax - cur.ax) * e, ay: cur.ay + (nx.ay - cur.ay) * e, r: e < 0.5 ? cur.r : nx.r };
    }
    let dx = 0;
    let dy = 0;
    for (const at of shakeAt ?? []) {
      const u = t - at;
      if (u >= 0 && u < 0.35) {
        const a = (1 - u / 0.35) ** 2 * 18;
        dx += Math.sin(u * 95) * a;
        dy += Math.cos(u * 71) * a * 0.6;
      }
    }
    const tx = p.ax - p.cx * p.s + dx;
    const ty = p.ay - p.cy * p.s + dy;
    const pad = cams[i].isolate;
    const spot =
      pad === undefined
        ? null
        : {
            position: "absolute" as const,
            left: tx + (p.r[0] - pad) * p.s,
            top: ty + (p.r[1] - pad) * p.s,
            width: (p.r[2] + 2 * pad) * p.s,
            height: (p.r[3] + 2 * pad) * p.s,
            borderRadius: 24,
            boxShadow: `0 0 ${Math.round(70 * p.s)}px 6000px rgba(10,10,11,0.86)`,
          };
    return { transform: `translate(${tx}px, ${ty}px) scale(${p.s})`, spot };
  }, [meta, cams, t, srcF, W, H, shakeAt]);

  if (!meta) return null;
  const cam = camera();
  return (
    <>
    <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: cam.transform }}>
      <OffthreadVideo src={staticFile(`capture/v3/${clip}.mp4`)} startFrom={Math.round(from * 30)} playbackRate={rate} muted style={{ display: "block", ...SOURCE[clip.startsWith("9x16") ? "9x16" : "16x9"] }} />
    </div>
    {cam.spot && <div style={cam.spot} />}
    </>
  );
}

/** The odds reading at a source time, for sound and overlays. */
export function oddsAt(meta: Meta, sec: number): number | null {
  const fr = meta.frames[Math.max(0, Math.min(meta.frames.length - 1, Math.round(sec * 30)))];
  return fr?.odds ? Number(fr.odds) : null;
}
