// The face reel, assembled from the plan scripts/reel-v3.ts writes (public/reel-v3/plan.json):
// the chosen takes as voice, face shots with punch-ins on emphasis words, the app captures as
// B-roll exactly where the script says, word-by-word captions in the old reel's style (white
// words, the one being said on a white chip), the finding labels, and the sound stem.

import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, Logo, Mask, easeIn, easeOut, prog } from "../v2/kit";
import { Footage, type Cam } from "../v3/footage";

export type Broll = { clip: string; from: number; rate?: number; target: Cam["target"]; fill: number };
export type Visual =
  | { kind: "face"; src: string; start: number; dur: number; offset?: number }
  | { kind: "broll"; start: number; dur: number; broll: Broll; label?: string; pip?: { src: string; offset: number } }
  | { kind: "split"; start: number; dur: number; broll: Broll; face: { src: string; offset: number } }
  | { kind: "card"; start: number; dur: number; pip?: { src: string; offset: number } };
export type Voice = { src: string; start: number; dur: number };
export type Word = { text: string; start: number; end: number; emph: boolean };
export type Plan = { duration: number; voice: Voice[]; visuals: Visual[]; words: Word[]; sfx: string | null };
export type ReelProps = { plan: Plan | null };

const FPS = 30;

/** 1 while an emphasis word is being said (eased in and out): the punch-in. */
function punch(words: Word[], t: number): number {
  let k = 0;
  for (const w of words) {
    if (!w.emph) continue;
    const up = prog(t, w.start - 0.06, w.start + 0.1, easeOut);
    const down = 1 - prog(t, w.end + 0.15, w.end + 0.5, easeIn);
    k = Math.max(k, Math.min(up, down));
  }
  return k;
}

function Face({ src, offset = 0, words, t }: { src: string; offset?: number; words: Word[]; t: number }) {
  const s = 1 + 0.12 * punch(words, t);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: "50% 38%" }}>
      <OffthreadVideo src={staticFile(src)} startFrom={Math.round(offset * FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
}

function Pip({ src, offset }: { src: string; offset: number }) {
  const { width, height } = useVideoConfig();
  const d = Math.round(width * 0.3);
  return (
    <div style={{ position: "absolute", right: 56, top: Math.round(height * 0.08), width: d, height: d, borderRadius: "50%", overflow: "hidden", border: `4px solid ${C.text}`, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
      <OffthreadVideo src={staticFile(src)} startFrom={Math.round(offset * FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function Label({ text }: { text: string }) {
  const t = useCurrentFrame() / FPS;
  const { height } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ position: "absolute", left: 64, right: 64, top: Math.round(height * 0.6) }}>
      <p style={{ margin: 0, fontFamily: F.display, fontSize: 84, lineHeight: 1.02, letterSpacing: "-0.035em" }}>
        {words.map((w, i) => {
          const accent = /^!|!$/.test(w);
          return (
            <React.Fragment key={i}>
              <Mask k={prog(t, i * 0.09, i * 0.09 + 0.4, easeOut)}>
                <span style={{ fontWeight: accent ? 900 : 700, color: accent ? C.loss : C.muted }}>{w.replace(/!/g, "")}</span>
              </Mask>{" "}
            </React.Fragment>
          );
        })}
      </p>
    </div>
  );
}

function EndCard() {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", gap: 36 }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(255,59,48,0.14) 0%, rgba(255,59,48,0) 70%)" }} />
      <div style={{ opacity: prog(t, 0, 0.3, easeOut) }}>
        <Logo height={150} />
      </div>
      <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 96, letterSpacing: "-0.045em", color: C.text }}>
        <Mask k={prog(t, 0.2, 0.7, easeOut)}>wouldthiswin.com</Mask>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 34, color: C.subtle }}>
        <Mask k={prog(t, 0.45, 0.9, easeOut)}>free. paste your repo.</Mask>
      </div>
    </AbsoluteFill>
  );
}

/** Word-by-word captions: a page of up to four words, the one being said on a white chip. */
function Captions({ words, t, top }: { words: Word[]; t: number; top: number }) {
  const pages: Word[][] = [];
  for (const w of words) {
    const page = pages.at(-1);
    if (!page || page.length >= 4 || /[.?!,]$/.test(page.at(-1)!.text) || w.start - page.at(-1)!.end > 0.6) pages.push([w]);
    else page.push(w);
  }
  const page = pages.find((p) => t >= p[0].start - 0.05 && t <= p.at(-1)!.end + 0.25);
  if (!page) return null;
  return (
    <div style={{ position: "absolute", left: 48, right: 48, top: Math.round(top), textAlign: "center" }}>
      <p style={{ margin: 0, fontFamily: F.display, fontWeight: 900, fontSize: 76, lineHeight: 1.15, letterSpacing: "-0.03em", color: C.text, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
        {page.map((w, i) => {
          const on = t >= w.start && t <= w.end + 0.08;
          return (
            <React.Fragment key={i}>
              <span style={{ padding: "0 10px", borderRadius: 12, background: on ? C.text : "transparent", color: on ? C.bg : C.text, textShadow: on ? "none" : undefined }}>{w.text.toLowerCase()}</span>{" "}
            </React.Fragment>
          );
        })}
      </p>
    </div>
  );
}

export function Reel({ plan }: ReelProps) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { height } = useVideoConfig();
  if (!plan) return <AbsoluteFill style={{ background: C.bg }} />;
  const seq = (start: number, dur: number) => ({ from: Math.round(start * FPS), durationInFrames: Math.max(1, Math.round(dur * FPS)) });
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      {plan.visuals.map((v, i) => (
        <Sequence key={i} {...seq(v.start, v.dur)}>
          {v.kind === "face" && <Face src={v.src} offset={v.offset} words={plan.words.map((w) => ({ ...w, start: w.start - v.start, end: w.end - v.start }))} t={t - v.start} />}
          {v.kind === "broll" && (
            <>
              <Footage clip={v.broll.clip} from={v.broll.from} rate={v.broll.rate} cams={[{ at: 0, target: v.broll.target, fill: v.broll.fill, ay: 0.32, isolate: 30 }]} />
              <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,10,11,0) 50%, rgba(10,10,11,0.85) 66%)" }} />
              {v.label && <Label text={v.label} />}
              {v.pip && <Pip src={v.pip.src} offset={v.pip.offset} />}
            </>
          )}
          {v.kind === "split" && (
            <>
              <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: height / 2, overflow: "hidden" }}>
                <Footage clip={v.broll.clip} from={v.broll.from} rate={v.broll.rate} cams={[{ at: 0, target: v.broll.target, fill: v.broll.fill, ay: 0.5, isolate: 30 }]} box={{ w: 1080, h: Math.round(height / 2) }} />
              </div>
              <div style={{ position: "absolute", left: 0, top: height / 2, right: 0, bottom: 0, overflow: "hidden", borderTop: `4px solid ${C.loss}` }}>
                <OffthreadVideo src={staticFile(v.face.src)} startFrom={Math.round(v.face.offset * FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </>
          )}
          {v.kind === "card" && (
            <>
              <EndCard />
              {v.pip && <Pip src={v.pip.src} offset={v.pip.offset} />}
            </>
          )}
        </Sequence>
      ))}
      {plan.voice.map((v, i) => (
        <Sequence key={`v${i}`} {...seq(v.start, v.dur)}>
          <Audio src={staticFile(v.src)} />
        </Sequence>
      ))}
      {plan.sfx && <Audio src={staticFile(plan.sfx)} />}
      {/* Captions in the lower third; in the split they sit on the seam, off the face. */}
      <Captions words={plan.words} t={t} top={plan.visuals.some((v) => v.kind === "split" && t >= v.start && t < v.start + v.dur) ? height / 2 - 130 : height * 0.68} />
    </AbsoluteFill>
  );
}
