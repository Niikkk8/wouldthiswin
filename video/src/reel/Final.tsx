// The single-take reel (scripts/reel-final.ts). The face is always there: full screen when
// it's talking to you, softly blurred and dimmed behind a floating card of real app UI when
// the voice is describing the app. So B-roll never reads as a screen recording, and every
// change is a motion (the card springing in, its content sliding, the card leaving), not a cut.
//
// Layout respects Instagram's overlays on a 1080x1920 Reel: nothing that matters in the top
// 250 px, the bottom 420 px, or under the right-hand button column.

import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { C, F, Grain, JUDGES, Logo, Sprite, clamp01, easeIn, easeInOut, easeOut, prog } from "../v2/kit";
import { Footage, type Cam } from "../v3/footage";
import type { Broll, Word } from "./Reel";

const FPS = 30;
/** The card: the app's UI lives here, inside the safe area. */
// Meta's Reels safe zone (top 14%, bottom 35%, 6% each side): everything readable lives in
// y 280 to 1248. Below that the app's caption, name and music bar cover the frame.
const CARD = { x: 72, y: 300, w: 936, h: 740 };
/** The UI's window inside the card: a header row for the label, real padding on every side. */
const WINDOW = { x: 28, y: 92, w: 936 - 56, h: 740 - 92 - 28 };
const CAPTION_TOP = 1078;
const CAPTION_SIDES = { left: 96, right: 192 };

export type FinalBeat = {
  kind: "face" | "broll" | "card";
  start: number;
  dur: number;
  broll?: Broll;
  label?: string;
  /** Seconds into the beat where the odds drop (shake, flash). */
  dropAt?: number;
};
export type FinalPlan = { duration: number; face: string; speech: number; words: Word[]; beats: FinalBeat[]; sfx: string | null };
export type FinalProps = { plan: FinalPlan | null };

const IN = 0.42;
const OUT = 0.3;

/** Runs of consecutive B-roll beats: one card per run, its content changing inside. */
function runsOf(beats: FinalBeat[]) {
  const runs: { start: number; end: number; beats: FinalBeat[] }[] = [];
  for (const b of beats) {
    if (b.kind !== "broll") continue;
    const last = runs.at(-1);
    if (last && Math.abs(last.end - b.start) < 0.02) {
      last.beats.push(b);
      last.end = b.start + b.dur;
    } else runs.push({ start: b.start, end: b.start + b.dur, beats: [b] });
  }
  return runs;
}

/** How present the card is at time t (0 = face only, 1 = card up), eased both ways. */
function presence(runs: ReturnType<typeof runsOf>, t: number) {
  let k = 0;
  for (const r of runs) k = Math.max(k, Math.min(prog(t, r.start - 0.05, r.start + IN, easeOut), 1 - prog(t, r.end - OUT, r.end + 0.05, easeIn)));
  return k;
}

function punch(words: Word[], t: number): number {
  let k = 0;
  for (const w of words) {
    if (!w.emph) continue;
    k = Math.max(k, Math.min(prog(t, w.start - 0.08, w.start + 0.14, easeOut), 1 - prog(t, w.end + 0.25, w.end + 0.7, easeInOut)));
  }
  return k;
}

function FaceLayer({ plan, t, k }: { plan: FinalPlan; t: number; k: number }) {
  // A slow breathing drift so the frame is never dead still, the punch on emphasis words,
  // and the push back and blur while a card is up.
  const drift = 1.02 + 0.02 * Math.sin((t / plan.duration) * Math.PI);
  const s = drift + 0.11 * punch(plan.words, t) + 0.07 * k;
  return (
    <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: "50% 36%", filter: `blur(${(k * 22).toFixed(1)}px) brightness(${(1 - 0.62 * k).toFixed(3)}) saturate(${(1 - 0.35 * k).toFixed(3)})` }}>
      <OffthreadVideo src={staticFile(plan.face)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
}

/** The card's header: the beat's label on the left, where it is in the story on the right. */
function Header({ label, index, count, t }: { label: string; index: number; count: number; t: number }) {
  const k = spring({ frame: Math.round(t * FPS) - 3, fps: FPS, config: { damping: 14, stiffness: 180, mass: 0.7 } });
  return (
    <div style={{ position: "absolute", left: 30, right: 30, top: 26, height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: k, transform: `translateY(${(1 - k) * -10}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: F.mono, fontSize: 26, letterSpacing: "0.14em", textTransform: "uppercase", color: C.text }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: C.loss, boxShadow: `0 0 18px ${C.loss}` }} />
        {label}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 24, letterSpacing: "0.08em", color: C.subtle, fontVariantNumeric: "tabular-nums" }}>
        {String(index).padStart(2, "0")} / {String(count).padStart(2, "0")}
      </div>
    </div>
  );
}

/** One beat inside the card's window: the capture framed on its element, sliding in. */
function CardContent({ beat, first, t }: { beat: FinalBeat; first: boolean; t: number }) {
  const b = beat.broll!;
  const enter = first ? 1 : prog(t, 0, 0.32, easeOut);
  const leave = prog(t, beat.dur - 0.18, beat.dur + 0.02, easeIn);
  const cams: Cam[] = b.cams ?? [{ at: 0, target: b.target!, fill: b.fill ?? 0.9, fillH: b.fillH, ay: 0.5, isolate: 26 }];
  // A slow push-in on every shot, so nothing is ever a still.
  const drift = 1 + 0.04 * prog(t, 0, beat.dur, easeInOut);
  const drop = beat.dropAt;
  const flash = drop === undefined ? 0 : Math.max(0, 1 - Math.abs(t - drop) / 0.35) * (t >= drop - 0.05 ? 1 : 0.3);
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - leave), transform: `translateY(${(1 - enter) * 26 - leave * 18}px)` }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${drift})`, transformOrigin: "50% 50%", filter: "brightness(0.97) saturate(0.96)" }}>
        <Footage clip={b.clip} from={b.from} rate={b.rate} cams={cams.map((c) => ({ ...c, fill: Math.min(c.fill ?? 0.9, 0.9) }))} shakeAt={b.shake} box={{ w: WINDOW.w, h: WINDOW.h }} />
      </div>
      {flash > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 55% at 50% 45%, rgba(255,59,48,${0.32 * flash}) 0%, rgba(255,59,48,0) 70%)`, mixBlendMode: "screen" }} />}
    </AbsoluteFill>
  );
}

type Numbering = Map<FinalBeat, number> & { count: number };

function Card({ run, t, numbering }: { run: ReturnType<typeof runsOf>[number]; t: number; numbering: Numbering }) {
  const f = Math.round((t - run.start) * FPS);
  const k = spring({ frame: f, fps: FPS, config: { damping: 15, stiffness: 150, mass: 0.85 } });
  const out = prog(t, run.end - OUT, run.end, easeIn);
  // The odds-drop shake moves the whole card.
  let dx = 0;
  let dy = 0;
  for (const b of run.beats) {
    if (b.dropAt === undefined) continue;
    const u = t - (b.start + b.dropAt);
    if (u >= 0 && u < 0.4) {
      const a = (1 - u / 0.4) ** 2 * 14;
      dx += Math.sin(u * 90) * a;
      dy += Math.cos(u * 70) * a * 0.5;
    }
  }
  const current = run.beats.find((b) => t >= b.start && t < b.start + b.dur) ?? run.beats[0];
  return (
    <div
      style={{
        position: "absolute",
        left: CARD.x,
        top: CARD.y,
        width: CARD.w,
        height: CARD.h,
        borderRadius: 44,
        background: "linear-gradient(180deg, #17171a 0%, #0f0f11 100%)",
        border: `2px solid ${C.borderStrong}`,
        boxShadow: "0 50px 140px rgba(0,0,0,0.65), 0 2px 0 rgba(255,255,255,0.05) inset",
        opacity: Math.min(1, k * 1.4) * (1 - out),
        transform: `translate(${dx}px, ${(1 - k) * 80 + out * 40 + dy}px) scale(${0.9 + 0.1 * k - 0.04 * out}) rotate(${(1 - k) * -2.5}deg)`,
      }}
    >
      <Header key={numbering.get(current)} label={current.label ?? ""} index={numbering.get(current) ?? 1} count={numbering.count} t={t - current.start} />
      <div style={{ position: "absolute", left: WINDOW.x, top: WINDOW.y, width: WINDOW.w, height: WINDOW.h, borderRadius: 26, overflow: "hidden", background: C.bg, border: `1px solid ${C.border}` }}>
        {run.beats.map((b, i) => (
          <Sequence key={i} from={Math.round((b.start - run.start) * FPS)} durationInFrames={Math.max(1, Math.round(b.dur * FPS))} layout="none">
            <CardContent beat={b} first={i === 0} t={t - b.start} />
          </Sequence>
        ))}
      </div>
    </div>
  );
}

/** Word-by-word captions: each word pops in as it's said, the one being said on a white chip. */
function Captions({ words, t }: { words: Word[]; t: number }) {
  const pages: Word[][] = [];
  for (const w of words) {
    const page = pages.at(-1);
    if (!page || page.length >= 3 || /[.?!,]$/.test(page.at(-1)!.text) || w.start - page.at(-1)!.end > 0.5) pages.push([w]);
    else page.push(w);
  }
  const page = pages.find((p, i) => t >= p[0].start - 0.06 && t < (pages[i + 1]?.[0].start ?? p.at(-1)!.end + 0.5) - 0.06);
  if (!page) return null;
  return (
    <div style={{ position: "absolute", left: CAPTION_SIDES.left, right: CAPTION_SIDES.right, top: CAPTION_TOP, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 12px" }}>
      {page.map((w, i) => {
        const pop = spring({ frame: Math.round((t - w.start + 0.06) * FPS), fps: FPS, config: { damping: 12, stiffness: 260, mass: 0.6 } });
        const on = t >= w.start - 0.02 && t <= w.end + 0.06;
        const chip = spring({ frame: Math.round((t - w.start) * FPS), fps: FPS, config: { damping: 16, stiffness: 300, mass: 0.5 } }) * (on ? 1 : 0);
        return (
          <span
            key={i}
            style={{
              position: "relative",
              isolation: "isolate",
              fontFamily: F.display,
              fontWeight: 900,
              fontSize: 68,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              padding: "2px 14px 8px",
              color: on ? C.bg : C.text,
              opacity: clamp01(pop * 1.3),
              transform: `translateY(${(1 - pop) * 18}px) scale(${0.86 + 0.14 * pop + (w.emph && on ? 0.06 : 0)})`,
              textShadow: on ? "none" : "0 6px 30px rgba(0,0,0,0.75)",
            }}
          >
            <span style={{ position: "absolute", inset: 0, borderRadius: 16, background: w.emph ? C.loss : C.text, opacity: chip, transform: `scale(${0.8 + 0.2 * chip})`, zIndex: -1 }} />
            <span style={{ color: on && w.emph ? C.text : undefined }}>{w.text.toLowerCase().replace(/[.,]$/, "")}</span>
          </span>
        );
      })}
    </div>
  );
}

function EndCard({ t }: { t: number }) {
  const f = Math.round(t * FPS);
  const sp = (d: number, cfg = { damping: 13, stiffness: 170, mass: 0.75 }) => spring({ frame: f - Math.round(d * FPS), fps: FPS, config: cfg });
  const logo = sp(0.05, { damping: 10, stiffness: 200, mass: 0.7 });
  const url = sp(0.22);
  const sub = sp(0.4);
  const float = Math.sin(t * 2.2) * 6;
  return (
    <AbsoluteFill style={{ opacity: prog(t, 0, 0.25, easeOut) }}>
      <AbsoluteFill style={{ background: C.bg }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 65% 40% at 50% 46%, rgba(255,59,48,${0.12 + 0.05 * Math.sin(t * 1.6)}) 0%, rgba(255,59,48,0) 70%)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, paddingBottom: 420 }}>
        <div style={{ transform: `translateY(${float}px) scale(${0.6 + 0.4 * logo}) rotate(${(1 - logo) * -8}deg)`, opacity: Math.min(1, logo * 1.5) }}>
          <Logo height={170} />
        </div>
        <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 104, letterSpacing: "-0.045em", color: C.text, opacity: url, transform: `translateY(${(1 - url) * 40}px)` }}>wouldthiswin.com</div>
        <div style={{ display: "flex", gap: 22 }}>
          {JUDGES.map((j, i) => {
            const k = sp(0.5 + i * 0.08, { damping: 9, stiffness: 220, mass: 0.6 });
            return (
              <div key={j} style={{ opacity: Math.min(1, k * 1.4), transform: `translateY(${(1 - k) * 60 + Math.sin(t * 3 + i) * 4}px)` }}>
                <Sprite judge={j} frame={t > 1.6 && t < 1.75 && i === 1 ? "blink" : "base"} scale={2} />
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 34, color: C.muted, letterSpacing: "0.04em", opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>free. link in bio.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function ReelFinal({ plan }: FinalProps) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (!plan) return <AbsoluteFill style={{ background: C.bg }} />;
  const runs = runsOf(plan.beats);
  const k = presence(runs, t);
  const end = plan.beats.find((b) => b.kind === "card");
  const brolls = plan.beats.filter((b) => b.kind === "broll");
  const numbering = Object.assign(new Map(brolls.map((b, i) => [b, i + 1] as const)), { count: brolls.length });
  // A soft vignette and grain so the frame always has texture.
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <FaceLayer plan={plan} t={t} k={k} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.55) 100%)" }} />
      {runs.map((r, i) => (
        <Sequence key={i} from={Math.round((r.start - 0.05) * FPS)} durationInFrames={Math.round((r.end - r.start + 0.1) * FPS)} layout="none">
          <Card run={r} t={t} numbering={numbering} />
        </Sequence>
      ))}
      {end && (
        <Sequence from={Math.round(end.start * FPS)} durationInFrames={Math.round(end.dur * FPS)} layout="none">
          <EndCard t={t - end.start} />
        </Sequence>
      )}
      {/* The end card says it in its own words: no captions over it. */}
      {!(end && t >= end.start + 0.15) && <Captions words={plan.words} t={t} />}
      <Grain frame={frame} opacity={0.05} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 80% at 50% 45%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 100%)", pointerEvents: "none" }} />
      <Audio src={staticFile(plan.face)} />
      {plan.sfx && <Audio src={staticFile(plan.sfx)} />}
    </AbsoluteFill>
  );
}
