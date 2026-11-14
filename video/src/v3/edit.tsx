// v3: every video is a shot list (src/v3/edits.json). A shot is real footage framed on an
// element, with one kinetic caption; cards are the end card. The cue sheets in sfx/cues read
// the same file, so cuts, words and odds changes land with their sounds.
//
// Visual language from the v2 launch cut: Archivo 800/900 captions rising word by word, key
// words white and heavy, the accent word red; a red glow on bad news, blue only on a gain;
// grain and vignette so black is never flat; hard cuts.

import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, Grain, JUDGES, Logo, Mask, Sprite, easeIn, easeOut, prog, sp } from "../v2/kit";
import { Footage, type Cam } from "./footage";

export type Caption = { text: string; at?: number; size?: number; pos?: "low" | "high" | "mid" };
export type Shot = {
  clip: string;
  from: number;
  dur: number;
  rate?: number;
  cams: Cam[];
  shake?: number[];
  glow?: number;
  tone?: "loss" | "gain";
  caption?: Caption;
};
export type EndCard = { card: "end"; dur: number; line?: string };
export type Item = Shot | EndCard;
/** `bare`: footage only (no texture, light or progress line), for the alpha overlay. */
export type Spec = { width: number; height: number; layout?: "full" | "split"; bare?: boolean; items: Item[] };

export const FPS = 30;
export const durationOf = (spec: Spec) => Math.round(spec.items.reduce((a, i) => a + i.dur, 0) * FPS);
/** Start time (s) of each item. */
export const starts = (spec: Spec) => spec.items.reduce<number[]>((a, i, k) => [...a, k ? a[k - 1] + spec.items[k - 1].dur : 0], []);

// ---------------------------------------------------------------- caption

type Word = { w: string; key: boolean; accent: boolean };
/** `*word*` is a key word (white, heavy); `!word!` is the accent (red). Everything else is muted. */
export function parseCaption(text: string): Word[] {
  return text.split(" ").filter(Boolean).map((raw) => {
    const key = /^\*.*\*[.,?!:]?$/.test(raw);
    const accent = /^!.*![.,?!:]?$/.test(raw);
    return { w: raw.replace(/^[*!]|[*!](?=[.,?!:]?$)/g, ""), key, accent };
  });
}

export const WORD_STAGGER = 0.09;

function KineticCaption({ c, portrait, split }: { c: Caption; portrait: boolean; split: boolean }) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const words = parseCaption(c.text);
  const at = c.at ?? 0;
  const size = c.size ?? (portrait ? 78 : split ? 92 : 72);
  const style: React.CSSProperties = split
    ? { left: 110, width: 640, top: "50%", transform: "translateY(-50%)" }
    : portrait
      ? { left: 72, width: 870, top: c.pos === "high" ? 280 : c.pos === "mid" ? 900 : 1260 }
      : { left: 110, width: 1500, bottom: c.pos === "high" ? undefined : 96, top: c.pos === "high" ? 90 : undefined };
  return (
    <div style={{ position: "absolute", ...style }}>
      <p style={{ margin: 0, fontFamily: F.display, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.035em", textWrap: "balance" }}>
        {words.map((x, i) => {
          // On frame 0 a caption that starts at or before 0 is already up: the first frame is the thumbnail.
          const k = at <= 0 && i === 0 && t === 0 ? 1 : at <= 0 ? 1 : prog(t, at + i * WORD_STAGGER, at + i * WORD_STAGGER + 0.42, easeOut);
          return (
            <React.Fragment key={i}>
              <Mask k={k}>
                <span style={{ fontWeight: x.key || x.accent ? 900 : 700, color: x.accent ? C.loss : x.key ? C.text : C.muted }}>{x.w}</span>
              </Mask>{" "}
            </React.Fragment>
          );
        })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- texture

/** Glow (screen-blended, so it tints the page's black), a scrim under the caption, a vignette. */
function Light({ glow = 0, tone = "loss", portrait, caption }: { glow?: number; tone?: "loss" | "gain"; portrait: boolean; caption: boolean }) {
  const frame = useCurrentFrame();
  const swell = glow * prog(frame / FPS, 0, 0.5, easeOut);
  const rgb = tone === "gain" ? "77,124,255" : "255,59,48";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {swell > 0 && <AbsoluteFill style={{ mixBlendMode: "screen", background: `radial-gradient(ellipse 60% 50% at 50% ${portrait ? 38 : 42}%, rgba(${rgb},${0.28 * swell}) 0%, rgba(${rgb},0) 70%)` }} />}
      {caption && (
        <AbsoluteFill
          style={{
            background: portrait
              ? "linear-gradient(180deg, rgba(10,10,11,0) 52%, rgba(10,10,11,0.88) 64%, rgba(10,10,11,0.88) 82%, rgba(10,10,11,0) 92%)"
              : "linear-gradient(180deg, rgba(10,10,11,0) 55%, rgba(10,10,11,0.9) 82%)",
          }}
        />
      )}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- the end card

function End({ line = "would yours *win?*", portrait }: { line?: string; portrait: boolean }) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pop = sp(frame, 0, { damping: 11, stiffness: 220, mass: 0.7 });
  const url = prog(t, 0.25, 0.75, easeOut);
  const words = parseCaption(line);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: portrait ? 44 : 30, background: C.bg }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 55% 45% at 50% 45%, rgba(255,59,48,0.14) 0%, rgba(255,59,48,0) 70%)" }} />
      <div style={{ transform: `scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 1.4) }}>
        <Logo height={portrait ? 150 : 128} />
      </div>
      <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: portrait ? 104 : 112, letterSpacing: "-0.045em", color: C.text, overflow: "hidden" }}>
        <Mask k={url}>wouldthiswin.com</Mask>
      </div>
      <div style={{ display: "flex", gap: portrait ? 22 : 18 }}>
        {JUDGES.map((j, i) => (
          <div key={j} style={{ opacity: prog(t, 0.45 + i * 0.08, 0.75 + i * 0.08, easeOut), transform: `translateY(${(1 - prog(t, 0.45 + i * 0.08, 0.85 + i * 0.08, easeOut)) * 24}px)` }}>
            <Sprite judge={j} frame={t > 1.4 && t < 1.55 && i === 2 ? "blink" : "base"} scale={portrait ? 2 : 1} />
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontFamily: F.display, fontSize: portrait ? 64 : 54, letterSpacing: "-0.03em" }}>
        {words.map((x, i) => (
          <React.Fragment key={i}>
            <Mask k={prog(t, 0.7 + i * WORD_STAGGER, 1.1 + i * WORD_STAGGER, easeOut)}>
              <span style={{ fontWeight: x.key ? 900 : 700, color: x.key ? C.text : C.muted }}>{x.w}</span>
            </Mask>{" "}
          </React.Fragment>
        ))}
      </p>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- the edit

function ShotView({ s, portrait, split, bare }: { s: Shot; portrait: boolean; split: boolean; bare?: boolean }) {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const outK = s.caption ? 1 - prog(frame / FPS, s.dur - 0.12, s.dur, easeIn) : 1;
  const footage = <Footage clip={s.clip} from={s.from} rate={s.rate} cams={s.cams} shakeAt={s.shake} box={split ? { w: Math.round(width * 0.58), h: Math.round(height * 0.78) } : undefined} />;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      {split ? (
        <div style={{ position: "absolute", right: 80, top: "11%", width: Math.round(width * 0.58), height: Math.round(height * 0.78), overflow: "hidden", borderRadius: 28, border: `2px solid ${C.borderStrong}`, background: C.bg }}>{footage}</div>
      ) : (
        footage
      )}
      {!bare && <Light glow={s.glow} tone={s.tone} portrait={portrait} caption={!!s.caption && !split} />}
      {s.caption && (
        <div style={{ opacity: outK }}>
          <KineticCaption c={s.caption} portrait={portrait} split={split} />
        </div>
      )}
    </AbsoluteFill>
  );
}

export function Edit({ spec }: { spec: Spec }) {
  const frame = useCurrentFrame();
  const portrait = spec.height > spec.width;
  const at = starts(spec);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {spec.items.map((it, i) => (
        <Sequence key={i} from={Math.round(at[i] * FPS)} durationInFrames={Math.round(it.dur * FPS)}>
          {"card" in it ? <End line={it.line} portrait={portrait} /> : <ShotView s={it} portrait={portrait} split={spec.layout === "split"} bare={spec.bare} />}
        </Sequence>
      ))}
      {!spec.bare && <Grain frame={frame} opacity={0.06} />}
      {/* A thin red progress line, as in the v2 cut: where you are in the story. */}
      {!spec.bare && <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${interpolate(frame, [0, durationOf(spec)], [0, 100])}%`, background: C.loss, opacity: 0.85 }} />}
    </AbsoluteFill>
  );
}
