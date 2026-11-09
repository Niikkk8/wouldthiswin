// The launch video, animated. Every time comes from timeline.json (scripts/plan_v2.py), which
// the music and the mix read too. Rules this file keeps:
// - Springs and eased tweens only; nothing linear except continuous drift.
// - The judges are pixel art: whole-number scales only, never scaled by a camera move. A
//   change of size is a hard cut on a beat (a punch-in). Cameras move the UI layers only.
// - Three transitions: a mask wipe, a match cut on the odds number, a zoom-through. The rest
//   are hard cuts on the beat.
// - Captions are the script's words, revealed as they're spoken.
// - 9:16 keeps everything out of Instagram's overlay (top 250, bottom 420, right 140).

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, C, F, FPS, Grain, Head, JUDGE_NAME, JudgeCard, Logo, Mask, SafeZones, clamp01, easeIn, easeOut, prog, rand, sp, type Judge } from "./kit";
import timeline from "./timeline.json";

type Aspect = "9x16" | "16x9";
export type LaunchV2Props = { aspect: Aspect; safeZones: boolean };

const TL = timeline;
const S = TL.scenes;
type SceneKey = keyof typeof S;
const ORDER: SceneKey[] = ["1a", "1b", "2", "3a", "3b", "4", "5", "6", "7", "8", "9"];

const AspectCtx = React.createContext<Aspect>("9x16");
const useAspect = () => React.useContext(AspectCtx);
/** Pick a layout value per aspect. */
const pick = <T,>(a: Aspect, tall: T, wide: T) => (a === "9x16" ? tall : wide);

const display = (size: number, weight = 900): React.CSSProperties => ({ fontFamily: F.display, fontWeight: weight, fontSize: size, lineHeight: 0.94, letterSpacing: "-0.045em", color: C.text, margin: 0 });
const labelStyle = (size = 28): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, letterSpacing: "0.08em", textTransform: "uppercase", color: C.subtle, margin: 0 });

const WIPE = 0.36; // seconds
const ZOOM = 0.42;

/** Deterministic camera shake that decays over `dur` seconds from `t0`. */
function shake(t: number, t0: number, amp: number, dur = 0.38) {
  const k = t - t0;
  if (k < 0 || k > dur) return { x: 0, y: 0 };
  const f = Math.round(t * FPS);
  const d = Math.pow(1 - k / dur, 2);
  // Whole pixels, so the pixel-art judges never sit between pixels.
  return { x: Math.round((rand(f) * 2 - 1) * amp * d), y: Math.round((rand(f + 99) * 2 - 1) * amp * d) };
}

/** A blink: 4 frames, on a fixed per-judge schedule. */
function blinking(judge: Judge, t: number, frame = "base") {
  const period = { engineer: 3.7, investor: 4.3, tired: 3.1 }[judge];
  const phase = { engineer: 1.1, investor: 2.6, tired: 0.4 }[judge];
  const k = (t + phase) % period;
  return k < 4 / FPS ? "blink" : frame;
}

/** The camera: moves and scales its children (UI layers only, never the judges). */
function Cam({ scale = 1, x = 0, y = 0, ox, oy, blur = 0, children }: { scale?: number; x?: number; y?: number; ox: number; oy: number; blur?: number; children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: `${ox}px ${oy}px`, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
}

/** Words that rise out of a mask as they're spoken, a little heavier and bigger on landing. */
function Caption({ line, t, end, x, y, w, size, align = "left", keys = [], accent = [] }: { line: { words: { text: string; t: number }[]; until?: number }; t: number; end?: number; x: number; y: number; w: number; size: number; align?: "left" | "center"; keys?: string[]; accent?: string[] }) {
  const until = end ?? line.until ?? 0;
  if (t >= until) return null;
  const out = prog(t, until - 0.28, until, easeIn);
  const frame = Math.round(t * FPS);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, textAlign: align }}>
      <p style={{ ...display(size, 800), lineHeight: 1.08, letterSpacing: "-0.035em" }}>
        {line.words.map((wd, i) => {
          const k = sp(frame, wd.t - 0.04, { damping: 18, stiffness: 240, mass: 0.6 });
          const pop = sp(frame, wd.t - 0.04, { damping: 9, stiffness: 260, mass: 0.5 });
          const key = keys.includes(wd.text);
          const acc = accent.includes(wd.text);
          return (
            <React.Fragment key={i}>
              <Mask k={k} out={out}>
                <span style={{ display: "inline-block", visibility: t < wd.t - 0.05 ? "hidden" : "visible", fontWeight: key || acc ? 900 : 700, color: acc ? C.loss : key ? C.text : C.muted, transform: `scale(${1 + 0.08 * (1 - pop)})`, transformOrigin: "50% 100%" }}>{wd.text}</span>
              </Mask>{" "}
            </React.Fragment>
          );
        })}
      </p>
    </div>
  );
}
const cap = (scene: SceneKey, n = 0) => TL.captions.filter((c) => c.scene === scene)[n];
/** When a word of a caption is said (the first word containing `text`). */
const saidAt = (c: { words: { text: string; t: number }[] }, text: string) => c.words.find((w) => w.text.includes(text))!.t;

/** A judge's name, in the app's mono, rising out of a mask in the card's corner when the voice names them. */
function NameTag({ name, t, at, size = 26 }: { name: string; t: number; at: number; size?: number }) {
  if (t < at - 0.06) return null;
  const k = sp(Math.round(t * FPS), at - 0.06, { damping: 16, stiffness: 260, mass: 0.5 });
  return (
    <div style={{ position: "absolute", left: 14, bottom: 14, padding: `${Math.round(size * 0.3)}px ${Math.round(size * 0.55)}px`, borderRadius: 999, background: C.bg, border: `2px solid ${C.borderStrong}`, opacity: clamp01(k * 2), transform: `translateY(${Math.round((1 - clamp01(k)) * 12)}px)` }}>
      <Mask k={k}>
        <span style={{ fontFamily: F.mono, fontSize: size, letterSpacing: "0.04em", color: C.text, whiteSpace: "nowrap" }}>{name}</span>
      </Mask>
    </div>
  );
}

function Odds({ value, size, color = C.text }: { value: number; size: number; color?: string }) {
  return <span style={{ ...display(size), letterSpacing: "-0.05em", color, display: "inline-block", fontVariantNumeric: "tabular-nums" }}>{Math.round(value)}%</span>;
}

function Chip({ delta, reason, tone, size }: { delta: string; reason: string; tone: "loss" | "gain"; size: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 16, alignItems: "center", fontFamily: F.mono, fontSize: size, padding: `${size * 0.32}px ${size * 0.6}px`, borderRadius: 12, background: tone === "loss" ? C.loss : C.gain, color: C.bg, fontWeight: 500, whiteSpace: "nowrap" }}>
      <span>{delta}</span>
      <span>{reason}</span>
    </span>
  );
}

const Caret = ({ h, on }: { h: number; on: boolean }) => <span style={{ display: "inline-block", width: Math.max(3, h * 0.07), height: h, background: C.text, marginLeft: 4, verticalAlign: "text-bottom", opacity: on ? 1 : 0 }} />;
const caretOn = (t: number, typing: boolean) => typing || Math.floor(t * 4.8) % 2 === 0;

// ============================================================== scenes

function S1a({ t }: { t: number }) {
  const a = useAspect();
  const frame = Math.round(t * FPS);
  const words = cap("1a").words;
  // Frame 0 is the thumbnail: the whole sentence is already there. As each word is said it
  // punches up in weight and a red underline travels with the voice.
  const lit = (i: number) => sp(frame, words[i].t - 0.03, { damping: 10, stiffness: 240, mass: 0.5 });
  const current = words.findLastIndex((w) => t >= w.t - 0.03);
  const W = (i: number, text: string) => {
    const p = lit(i);
    const isCur = i === current && t < words[words.length - 1].t + 0.6;
    return (
      <span key={i} style={{ display: "inline-block", transform: `scale(${1 + 0.06 * Math.sin(Math.PI * clamp01(p))})`, transformOrigin: "50% 90%", position: "relative" }}>
        {text}
        <span style={{ position: "absolute", left: 0, right: "0.12em", bottom: "-0.02em", height: "0.07em", background: C.loss, transformOrigin: "0% 50%", transform: `scaleX(${isCur ? clamp01(p) : 0})` }} />
      </span>
    );
  };
  const push = 1 + 0.035 * prog(t, 0, S["1a"].end, Easing.bezier(0.33, 0, 0.67, 1));
  const ox = pick(a, 500, 700);
  return (
    <AbsoluteFill>
      <Cam scale={push} ox={ox} oy={pick(a, 760, 420)}>
        <div style={{ position: "absolute", left: pick(a, 72, 120), top: pick(a, 310, 120), display: "flex", alignItems: "center", gap: 16 }}>
          <Logo height={40} />
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, letterSpacing: "-0.03em", color: C.text }}>wouldthiswin</span>
        </div>
        <div style={{ position: "absolute", left: pick(a, 72, 120), width: pick(a, 852, 1500), top: pick(a, 470, 330) }}>
          <p style={{ ...display(pick(a, 150, 150)) }}>
            {pick(a, [[0], [1], [2], [3]], [[0, 1], [2, 3]]).map((ln, li) => (
              <span key={li} style={{ display: "block" }}>
                {ln.map((i) => (
                  <React.Fragment key={i}>{W(i, words[i].text.replace(/[.?]$/, ""))}{i === words.length - 1 && <span style={{ color: C.loss }}>?</span>} </React.Fragment>
                ))}
              </span>
            ))}
          </p>
        </div>
      </Cam>
      <PanelRow t={t} top={pick(a, 1186, 640)} left={pick(a, 72, 1100)} dim={0.45} />
    </AbsoluteFill>
  );
}

function PanelRow({ t, top, left, dim, frames = {} }: { t: number; top: number; left: number; dim: number; frames?: Partial<Record<Judge, string>> }) {
  return (
    <div style={{ position: "absolute", left, top, display: "flex", gap: 24 }}>
      {(["engineer", "investor", "tired"] as Judge[]).map((j) => (
        <JudgeCard key={j} judge={j} scale={2} dim={dim} frame={frames[j] ?? blinking(j, t)} />
      ))}
    </div>
  );
}

function S1b({ t }: { t: number }) {
  const a = useAspect();
  const frame = Math.round(t * FPS);
  const t0 = S["1b"].slam;
  const words = pick(a, [["would"], ["this"], ["win", "?"]], [["would this"], ["win", "?"]]) as [string, string?][];
  const sh = shake(t, t0 + 0.2, 10, 0.3);
  const push = 1 + 0.03 * prog(t, t0, S["1b"].end, Easing.bezier(0.33, 0, 0.67, 1));
  return (
    <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Cam scale={push} ox={pick(a, 400, 600)} oy={pick(a, 700, 400)}>
        <div style={{ position: "absolute", left: pick(a, 72, 120), top: pick(a, 360, 150) }}>
          {words.map(([w, q], i) => {
            const k = sp(frame, t0 + i * 0.07, { damping: 16, stiffness: 320, mass: 0.7 });
            const qk = sp(frame, t0 + 0.2, { damping: 11, stiffness: 300, mass: 0.6 });
            return (
              <p key={i} style={{ ...display(pick(a, 250, 230)), lineHeight: 0.86, opacity: clamp01(k * 3), transform: `scale(${1 + 0.6 * (1 - k)})`, transformOrigin: "0% 60%", filter: `blur(${(1 - clamp01(k)) * 14}px)`, whiteSpace: "nowrap" }}>
                {w}
                {q && <span style={{ display: "inline-block", color: C.loss, textShadow: "0 0 60px rgba(255,59,48,0.45)", transform: `scale(${1 + 0.9 * (1 - qk)}) rotate(${(1 - qk) * -12}deg)`, opacity: clamp01(qk * 3) }}>{q}</span>}
              </p>
            );
          })}
        </div>
      </Cam>
      {/* The panel reacts on the slam: a hard switch of faces, no scaling. */}
      <PanelRow t={t} top={pick(a, 1186, 640)} left={pick(a, 72, 1100)} dim={0} frames={t >= t0 + 0.2 ? { engineer: "skeptical", investor: "eyebrow", tired: "perked" } : {}} />
    </AbsoluteFill>
  );
}

function S2({ t }: { t: number }) {
  const a = useAspect();
  const s = S["2"];
  const url = "github.com/latenight/queue-less";
  const typed = url.slice(0, Math.max(0, Math.floor((t - s.typeStart) / s.typeCharSec)));
  const typing = t >= s.typeStart && typed.length < url.length;
  const frame = Math.round(t * FPS);
  const press = sp(frame, s.press, { damping: 9, stiffness: 400, mass: 0.4 });
  const down = s.press <= t && t < s.press + 0.12 ? 1 : 0;
  const colX = pick(a, 72, 460);
  const colW = pick(a, 852, 1000);
  const btnY = pick(a, 1040, 610);
  // The camera eases toward the button while you type, then the zoom-through takes over.
  const push = 1 + 0.035 * prog(t, s.start, s.press, Easing.bezier(0.33, 0, 0.2, 1));
  return (
    <AbsoluteFill>
      <Cam scale={push} ox={colX + colW / 2} oy={btnY + 70}>
        <div style={{ position: "absolute", left: colX, width: colW, top: pick(a, 560, 150) }}>
          <p style={{ ...display(pick(a, 112, 100)), opacity: 0.22 }}>
            Would this
            <br />
            win?
          </p>
        </div>
        <div style={{ position: "absolute", left: colX, width: colW, top: pick(a, 820, 390) }}>
          <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 34, color: C.muted, margin: "0 0 18px" }}>Your GitHub repo</p>
          <div style={{ height: 140, borderRadius: 22, border: `3px solid ${C.text}`, background: C.surface, display: "flex", alignItems: "center", padding: "0 34px", boxShadow: "0 0 0 8px rgba(244,244,242,0.06)" }}>
            <span style={{ fontFamily: F.mono, fontSize: pick(a, 40, 46), color: typed ? C.text : C.subtle, whiteSpace: "nowrap" }}>{typed || "github.com/you/your-project"}</span>
            {typed && <Caret h={56} on={caretOn(t, typing)} />}
          </div>
        </div>
        <div style={{ position: "absolute", left: colX, width: colW, top: btnY, height: 140, borderRadius: 22, background: C.text, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 - 0.05 * down + 0.0 * press})`, filter: `brightness(${1 - 0.15 * down})` }}>
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 52, letterSpacing: "-0.03em", color: C.bg }}>{t >= s.press ? "Finding a panel" : "Face the panel"}</span>
        </div>
      </Cam>
      <Caption line={cap("2")} t={t} end={s.end + ZOOM} x={pick(a, 72, 460)} y={pick(a, 1330, 840)} w={pick(a, 852, 1000)} size={pick(a, 72, 64)} keys={["paste", "repo."]} />
    </AbsoluteFill>
  );
}

const TREE: { name: string; depth: number; dir?: boolean }[] = [
  { name: "README.md", depth: 0 },
  { name: "package.json", depth: 0 },
  { name: "next.config.js", depth: 0 },
  { name: "app/", depth: 0, dir: true },
  { name: "layout.tsx", depth: 1 },
  { name: "page.tsx", depth: 1 },
  { name: "server/", depth: 0, dir: true },
  { name: "db.ts", depth: 1 },
  { name: "queue.ts", depth: 1 },
  { name: "notify.ts", depth: 1 },
  { name: "estimate.ts", depth: 1 },
];
const TARGETS = [1, 8, 9];

function S3a({ t }: { t: number }) {
  const a = useAspect();
  const s = S["3a"];
  const frame = Math.round(t * FPS);
  const red = t >= s.red;
  const ROW = pick(a, 54, 60);
  const treeTop = pick(a, 720, 200);
  const treeX = pick(a, 80, 1080);
  const monoW = 0.6 * 36;
  const card = { x: pick(a, 72, 120), y: pick(a, 360, 300), w: pick(a, 852, 780) };
  const start = pick(a, { x: card.x + card.w - 48, y: 598 }, { x: card.x + card.w, y: 410 });
  const focusRow = treeTop + 9 * ROW + 24;
  // After the red hit the camera pushes toward notify.ts until the cut.
  const push = 1 + 0.12 * prog(t, s.red, S["3b"].start, Easing.bezier(0.5, 0, 0.75, 0));
  const dimOthers = prog(t, s.red, s.red + 0.3, easeOut);
  const stamp = sp(frame, s.red + 0.08, { damping: 10, stiffness: 320, mass: 0.6 });
  return (
    <AbsoluteFill>
      <Cam scale={push} ox={treeX + 200} oy={focusRow}>
        <p style={{ ...labelStyle(30), position: "absolute", left: card.x, top: pick(a, 290, 120) }}>the scan · readme claims</p>
        <div style={{ position: "absolute", left: card.x, width: card.w, top: card.y, borderRadius: 24, padding: "30px 34px", border: `3px solid ${red ? C.loss : C.borderStrong}`, background: red ? "rgba(255,59,48,0.10)" : C.surface, transform: `translateY(${(1 - sp(frame, s.start, { damping: 16, stiffness: 180 })) * 40}px)`, opacity: clamp01(sp(frame, s.start) * 2) }}>
          <p style={{ fontFamily: F.display, fontWeight: 800, fontSize: 46, letterSpacing: "-0.03em", color: C.text, margin: 0, lineHeight: 1.08 }}>SMS alerts when your turn is close</p>
          <p style={{ fontFamily: F.mono, fontSize: 30, color: red ? C.loss : C.subtle, margin: "16px 0 0" }}>{red ? "onTurnClose logs instead of sending" : "searching the code…"}</p>
        </div>
        <p style={{ ...labelStyle(26), position: "absolute", left: treeX, top: treeTop - 60 }}>latenight/queue-less</p>
        {TREE.map((f, i) => {
          const k = sp(frame, s.cascade + i * s.cascadeStagger, { damping: 15, stiffness: 220, mass: 0.6 });
          const hit = TARGETS.includes(i);
          const isRed = i === 9 && red;
          const focus = hit || f.dir;
          const dim = focus ? (isRed ? 0 : 0.35 * dimOthers) : 0.62;
          return (
            <p key={f.name} style={{ position: "absolute", left: treeX + f.depth * 44, top: treeTop + i * ROW, margin: 0, fontFamily: F.mono, fontSize: 36, color: isRed ? C.loss : hit ? C.text : f.dir ? C.muted : C.subtle, opacity: clamp01(k * 2) * (1 - dim), transform: `translateX(${(1 - k) * -40}px)`, filter: !focus || dim > 0.3 ? `blur(${focus ? 0.8 : 1.4}px)` : undefined }}>
              {f.dir ? "▾ " : ""}
              {f.name}
            </p>
          );
        })}
        <svg width={pick(a, 1080, 1920)} height={pick(a, 1920, 1080)} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {TARGETS.map((ti, n) => {
            const f = TREE[ti];
            const endX = treeX + f.depth * 44 + (a === "9x16" ? f.name.length * monoW + 22 : -22);
            const endY = treeTop + ti * ROW + 24;
            const isRed = n === 2 && red;
            const draw = prog(t, s.beams[n], s.beams[n] + s.beamSec, easeOut);
            const d = a === "9x16" ? `M ${start.x} ${start.y} C ${start.x} ${start.y + 160}, ${endX + 260} ${endY}, ${endX} ${endY}` : `M ${start.x} ${start.y} C ${start.x + 120} ${start.y}, ${endX - 160} ${endY}, ${endX} ${endY}`;
            return (
              <g key={ti} opacity={isRed ? 1 : 1 - 0.5 * dimOthers}>
                <path d={d} fill="none" stroke={isRed ? C.loss : C.text} strokeOpacity={isRed ? 1 : 0.55} strokeWidth={isRed ? 5 : 3} strokeLinecap="butt" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} style={{ filter: isRed ? "drop-shadow(0 0 12px rgba(255,59,48,0.8))" : undefined }} />
                <circle cx={endX} cy={endY} r={isRed ? 9 : 6} fill={isRed ? C.loss : C.text} opacity={draw >= 1 ? 1 : 0} />
              </g>
            );
          })}
          <circle cx={start.x} cy={start.y} r={8} fill={red ? C.loss : C.text} opacity={clamp01((t - s.beams[0]) * 8)} />
        </svg>
        {red && (
          <div style={{ position: "absolute", left: pick(a, treeX + 44 + "notify.ts".length * monoW + 52, treeX + 44 + "notify.ts".length * monoW + 30), top: treeTop + 9 * ROW - 6, transform: `scale(${1.6 - 0.6 * stamp}) rotate(-3deg)`, transformOrigin: "0% 50%", opacity: clamp01(stamp * 3) }}>
            <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 32, color: C.bg, background: C.loss, padding: "6px 14px", borderRadius: 8, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>NOT FOUND: SMS</span>
          </div>
        )}
      </Cam>
      {/* The odds, small, top right: the match cut grows it into the next shot. */}
      <div style={{ position: "absolute", left: pick(a, 760, 1620), top: pick(a, 280, 110), textAlign: "right", width: 160 }}>
        <p style={{ ...labelStyle(20), margin: 0 }}>odds</p>
        <Odds value={50} size={64} />
      </div>
      <Caption line={cap("3a")} t={t} x={pick(a, 72, 120)} y={pick(a, 1340, 820)} w={pick(a, 852, 800)} size={64} keys={["readme", "actual", "code."]} />
      <Caption line={cap("3a", 1)} t={t} end={s.end + 0.5} x={pick(a, 72, 120)} y={pick(a, 1340, 820)} w={pick(a, 852, 800)} size={64} keys={["didn't", "build?"]} />
    </AbsoluteFill>
  );
}

function S3b({ t }: { t: number }) {
  const a = useAspect();
  const s = S["3b"];
  const frame = Math.round(t * FPS);
  const slam = sp(frame, s.drop, { damping: 13, stiffness: 420, mass: 0.7 });
  const dropped = t >= s.drop;
  const sh = shake(t, s.drop, 22, 0.42);
  const flash = dropped ? Math.pow(1 - prog(t, s.drop, s.drop + 0.3, easeOut), 1.4) : 0;
  const chip = sp(frame, s.drop + 0.15, { damping: 11, stiffness: 260, mass: 0.6 });
  const push = 1 + 0.05 * prog(t, s.drop + 0.3, s.end, Easing.bezier(0.33, 0, 0.67, 1));
  const x = pick(a, 72, 200);
  return (
    <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 55% at 45% 45%, rgba(255,59,48,${dropped ? 0.3 : 0.05}) 0%, rgba(255,59,48,0) 70%)` }} />
      <Cam scale={push} ox={x + 300} oy={pick(a, 800, 480)}>
        <div style={{ position: "absolute", left: x, top: pick(a, 470, 150) }}>
          <p style={{ ...labelStyle(30) }}>chance to win</p>
          <p style={{ margin: "26px 0 0", fontFamily: F.mono, fontSize: 84, color: C.subtle, textDecoration: "line-through", textDecorationThickness: 6, opacity: dropped ? clamp01(slam * 2) : 0 }}>50%</p>
          <div style={{ marginTop: 6, marginLeft: -14, transform: `scale(${dropped ? 1 + 0.38 * (1 - slam) : 1})`, transformOrigin: "10% 80%" }}>
            <Odds value={dropped ? 31 : 50} size={pick(a, 330, 360)} color={dropped ? C.loss : C.text} />
          </div>
          <div style={{ marginTop: 34, opacity: clamp01(chip * 3), transform: `scale(${0.8 + 0.2 * chip})`, transformOrigin: "0% 50%" }}>
            <Chip delta="-19" reason="couldn't find SMS" tone="loss" size={38} />
          </div>
        </div>
      </Cam>
      <Caption line={cap("3b")} t={t} end={s.end} x={pick(a, 72, 1080)} y={pick(a, 1270, 540)} w={pick(a, 852, 720)} size={pick(a, 58, 64)} keys={["didn't", "build?", "odds"]} accent={["drop."]} />
      <AbsoluteFill style={{ background: C.loss, opacity: 0.45 * flash, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
}

const Q1 = "Your README promises SMS alerts when your turn is close. Which file sends one?";

function S4({ t }: { t: number }) {
  const a = useAspect();
  const s = S["4"];
  const frame = Math.round(t * FPS);
  const punched = t >= s.punch;
  const words = Q1.split(" ");
  const shown = Math.max(0, Math.min(words.length, Math.floor((t - s.qStart) / s.qWordSec) + 1));
  const talking = punched && shown < words.length + 2 && Math.floor(t * 7) % 2 === 0;
  const caughtAt = 4;
  const underline = prog(t, s.qStart + 6 * s.qWordSec, s.qStart + 6 * s.qWordSec + 0.25, easeOut);
  const timer = punched ? Math.max(27, 30 - Math.floor(t - s.punch)) : 30;
  const left = pick(a, 72, 120);
  const top = pick(a, 280, 130);
  const push = 1 + 0.04 * prog(t, s.punch, s.end, Easing.bezier(0.33, 0, 0.67, 1));
  return (
    <AbsoluteFill>
      {/* Judges: three slide in at 2x, staggered. On the punch-in beat the Engineer cuts to 4x. */}
      {!punched ? (
        <div style={{ position: "absolute", left, top: pick(a, 420, 300), display: "flex", gap: 24 }}>
          {(["engineer", "investor", "tired"] as Judge[]).map((j, i) => {
            const k = sp(frame, s.slide[i], { damping: 15, stiffness: 200, mass: 0.7 });
            return <JudgeCard key={j} judge={j} scale={2} frame={blinking(j, t)} style={{ transform: `translateY(${Math.round((1 - k) * 160)}px)`, opacity: clamp01(k * 2) }} />;
          })}
        </div>
      ) : (
        <div style={{ position: "absolute", left, top, display: "flex", flexDirection: pick(a, "row", "column") as React.CSSProperties["flexDirection"], gap: 24, alignItems: "flex-start" }}>
          <div style={{ position: "relative" }}>
            <JudgeCard judge="engineer" scale={4} frame={talking ? "talk" : "base"} />
            <NameTag name={JUDGE_NAME.engineer} t={t} at={saidAt(cap("4", 1), "engineer")} />
          </div>
          <div style={{ display: "flex", flexDirection: pick(a, "column", "row") as React.CSSProperties["flexDirection"], gap: 24 }}>
            <JudgeCard judge="investor" scale={pick(a, 2, 1)} dim={0.7} frame={blinking("investor", t)} />
            <JudgeCard judge="tired" scale={pick(a, 2, 1)} dim={0.7} frame={blinking("tired", t)} />
          </div>
        </div>
      )}
      <Cam scale={push} ox={pick(a, 500, 1200)} oy={pick(a, 1000, 400)}>
        {punched && (
          <div style={{ position: "absolute", left: pick(a, 72, 720), width: pick(a, 852, 1080), top: pick(a, 850, 150) }}>
            <p style={{ ...labelStyle(30), color: C.text, display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 16, height: 16, borderRadius: 8, background: C.loss, display: "inline-block" }} />
              question 1 of 3
              <span style={{ marginLeft: "auto", fontSize: 44, letterSpacing: 0, color: C.text }}>0:{String(timer).padStart(2, "0")}</span>
            </p>
            <p style={{ ...display(pick(a, 70, 76), 800), lineHeight: 1.04, letterSpacing: "-0.035em", marginTop: 26 }}>
              {words.map((w, i) => {
                const k = sp(frame, s.qStart + i * s.qWordSec, { damping: 16, stiffness: 260, mass: 0.5 });
                const caught = i === caughtAt || i === caughtAt + 1;
                return (
                  <React.Fragment key={i}>
                    <span style={{ display: "inline-block", position: "relative", color: caught ? C.loss : C.text, opacity: i < shown ? clamp01(k * 1.6) : 0.12, transform: `translateY(${(1 - clamp01(k)) * 14}px)` }}>
                      {w}
                      {caught && <span style={{ position: "absolute", left: 0, right: i === caughtAt ? "-0.28em" : 0, bottom: "-0.04em", height: "0.07em", background: C.loss, transformOrigin: "0% 50%", transform: `scaleX(${i === caughtAt ? clamp01(underline * 2) : clamp01(underline * 2 - 1)})` }} />}
                    </span>{" "}
                  </React.Fragment>
                );
              })}
            </p>
          </div>
        )}
      </Cam>
      <Caption line={cap("4")} t={t} x={pick(a, 72, 720)} y={pick(a, 1300, 820)} w={pick(a, 852, 1080)} size={54} keys={["three", "judges", "grill"]} />
      <Caption line={cap("4", 1)} t={t} x={pick(a, 72, 720)} y={pick(a, 1300, 820)} w={pick(a, 852, 1080)} size={54} keys={["engineer", "proof."]} />
    </AbsoluteFill>
  );
}

const A1 = "None yet. The turn-close event fires, but Twilio isn't wired. That's tonight's job.";

function S5({ t }: { t: number }) {
  const a = useAspect();
  const s = S["5"];
  const frame = Math.round(t * FPS);
  const typed = Math.max(0, Math.min(A1.length, Math.floor((t - s.typeStart) / s.typeCharSec)));
  const ticked = t >= s.tick;
  const punched = t >= s.punch;
  const roll = sp(frame, s.tick, { damping: 14, stiffness: 200, mass: 0.6 });
  const odds = ticked ? 31 + 5 * clamp01(roll) : 31;
  const chip = sp(frame, s.tick + 0.08, { damping: 11, stiffness: 260, mass: 0.6 });
  const L = pick(a, 72, 120);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: L, top: pick(a, 280, 120), display: "flex", alignItems: "flex-end", gap: 26 }}>
        <Odds value={odds} size={180} color={ticked ? C.text : C.loss} />
        <div style={{ paddingBottom: 22, opacity: clamp01(chip * 3), transform: `translateY(${(1 - chip) * 20}px)` }}>
          <p style={{ margin: "0 0 12px", fontFamily: F.mono, fontSize: 40, color: C.subtle, textDecoration: "line-through" }}>31%</p>
          <Chip delta="+5" reason="straight answer" tone="gain" size={32} />
        </div>
      </div>
      <div style={{ position: "absolute", left: L, width: pick(a, 852, 900), top: pick(a, 520, 380), borderRadius: 24, border: `3px solid ${typed < A1.length ? C.text : C.borderStrong}`, background: C.surface, padding: "28px 32px" }}>
        <p style={{ ...labelStyle(24), margin: "0 0 14px" }}>your answer · 0:2{Math.max(1, 6 - Math.floor(Math.max(0, t - s.start)))}</p>
        <p style={{ fontFamily: F.mono, fontSize: 38, lineHeight: 1.35, color: C.text, margin: 0, minHeight: 154 }}>
          {A1.slice(0, typed)}
          <Caret h={46} on={caretOn(t, typed > 0 && typed < A1.length)} />
        </p>
      </div>
      {/* The Investor: a hard cut to 3x on a beat while the answer types (6b names him); impressed once the odds tick. */}
      <div style={{ position: "absolute", left: pick(a, 72, 1040), top: pick(a, 930, 160), display: "flex", gap: 24, alignItems: "flex-end" }}>
        {punched ? (
          <>
            <div style={{ position: "relative" }}>
              <JudgeCard judge="investor" scale={3} frame={ticked ? "impressed" : blinking("investor", t, "calculating")} />
              <NameTag name={JUDGE_NAME.investor} t={t} at={saidAt(cap("5"), "investor")} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <JudgeCard judge="engineer" scale={1} dim={0.7} frame={blinking("engineer", t)} />
              <JudgeCard judge="tired" scale={1} dim={0.7} frame={blinking("tired", t)} />
            </div>
          </>
        ) : (
          (["investor", "engineer", "tired"] as Judge[]).map((j) => <JudgeCard key={j} judge={j} scale={2} dim={j === "investor" ? 0 : 0.5} frame={blinking(j, t)} />)
        )}
      </div>
      <Caption line={cap("5")} t={t} x={pick(a, 72, 120)} y={pick(a, 1345, 830)} w={pick(a, 852, 1500)} size={54} keys={["investor", "paying."]} />
    </AbsoluteFill>
  );
}

function S6({ t }: { t: number }) {
  const a = useAspect();
  const s = S["6"];
  const frame = Math.round(t * FPS);
  const [p0, p1] = s.pause;
  const paused = t >= p0 && t < p1;
  const jolted = t >= s.jolt;
  const u = t - s.start;
  const face = jolted ? "perked" : u < 0.5 ? "sip" : "dozing";
  const jolt = sp(frame, s.jolt, { damping: 8, stiffness: 300, mass: 0.5 });
  const lift = jolted ? Math.round(-28 * Math.sin(Math.PI * clamp01(jolt))) : 0;
  const sh = shake(t, s.jolt, 9, 0.25);
  const left = pick(a, 72 + (852 - 518) / 2, 220);
  const top = pick(a, 360, 210);
  // The z's drift up while he sleeps, hold still in the silence, and vanish on the jolt.
  const zt = paused ? p0 : t;
  return (
    <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <p style={{ ...labelStyle(30), position: "absolute", left: pick(a, 72, 120), top: pick(a, 280, 110) }}>question 3 of 3</p>
      <div style={{ position: "absolute", left, top: top + lift }}>
        <JudgeCard judge="tired" scale={4} frame={face} />
        <NameTag name={JUDGE_NAME.tired} t={t} at={saidAt(cap("6"), "tired")} />
      </div>
      {!jolted &&
        u > 0.5 &&
        [0, 1, 2].map((i) => {
          const c = ((zt - s.start - 0.5) / 1.8 + i / 3) % 1;
          return (
            <span key={i} style={{ position: "absolute", left: left + 440 + c * 90, top: top + 60 - c * 170, fontFamily: F.display, fontWeight: 900, fontSize: 48 + c * 40, color: C.muted, opacity: Math.sin(Math.PI * c) }}>
              z
            </span>
          );
        })}
      {jolted && <span style={{ position: "absolute", left: left + 470, top: top - 10, fontFamily: F.display, fontWeight: 900, fontSize: 120, color: C.loss, transform: `scale(${clamp01(jolt)}) rotate(8deg)`, opacity: 1 - prog(t, s.jolt + 0.4, s.end, easeIn) }}>!</span>}
      <p style={{ position: "absolute", left: pick(a, 72, 860), width: pick(a, 852, 900), top: pick(a, 930, 230), ...display(64, 800), opacity: 0.32 }}>
        <span style={{ color: C.loss }}>In one sentence.</span> What is it?
      </p>
      <p style={{ position: "absolute", left: pick(a, 72, 860), top: pick(a, 1060, 380), margin: 0, fontFamily: F.mono, fontSize: 96, color: C.subtle }}>0:{String(Math.max(12, 19 - Math.floor(Math.min(t, p0) - s.start))).padStart(2, "0")}</p>
      <Caption line={cap("6")} t={t} x={pick(a, 72, 860)} y={pick(a, 1290, 560)} w={pick(a, 852, 900)} size={pick(a, 56, 60)} keys={["tired", "judge", "forty", "go."]} />
    </AbsoluteFill>
  );
}

const CHAT: { judge: Judge; text: string }[] = [
  { judge: "tired", text: "the qr code thing. which one was that again." },
  { judge: "engineer", text: "queue.ts is real. notify.ts logs “turn close” and stops." },
  { judge: "investor", text: "Clinics paying per location is a real model. Two maybes is not traction." },
  { judge: "engineer", text: "Credit for saying it straight." },
];

function S7({ t }: { t: number }) {
  const a = useAspect();
  const s = S["7"];
  const frame = Math.round(t * FPS);
  const typingK = sp(frame, s.typing, { damping: 14, stiffness: 220 });
  // The thread scrolls up as it fills: translation only (the heads are pixel art).
  const scroll = Math.round(-60 * prog(t, s.bubbles[2], s.end, Easing.bezier(0.33, 0, 0.67, 1)));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: pick(a, 72, 120), top: pick(a, 280, 110) }}>
        <p style={{ fontFamily: F.mono, fontSize: 36, color: C.text, fontWeight: 700, margin: 0 }}>#panel-queue-less</p>
        <p style={{ fontFamily: F.mono, fontSize: 26, color: C.subtle, margin: "8px 0 0" }}>you can read this. you can't reply.</p>
      </div>
      {/* The thread scrolls inside its own window, under the channel header. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: pick(a, 390, 220), bottom: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: pick(a, 72, 120), width: pick(a, 852, 960), top: 10 + scroll, display: "flex", flexDirection: "column", gap: 24 }}>
        {CHAT.map((m, i) => {
          const k = sp(frame, s.bubbles[i], { damping: 13, stiffness: 300, mass: 0.6 });
          if (t < s.bubbles[i]) return null;
          const newest = i === CHAT.length - 1 || t < s.bubbles[i + 1];
          return (
            <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", opacity: clamp01(k * 2) * (newest ? 1 : 0.62), transform: `translateY(${Math.round((1 - k) * 50)}px) scale(${0.92 + 0.08 * clamp01(k)})`, transformOrigin: "0% 0%" }}>
              <Head judge={m.judge} scale={1} />
              <div style={{ background: C.surface2, borderRadius: "8px 26px 26px 26px", padding: "18px 26px 22px", maxWidth: 720, border: `2px solid ${newest ? C.borderStrong : C.border}` }}>
                <p style={{ fontFamily: F.mono, fontSize: 24, color: C.subtle, margin: "0 0 6px" }}>{JUDGE_NAME[m.judge]}</p>
                <p style={{ fontFamily: F.display, fontSize: 42, lineHeight: 1.2, color: C.text, margin: 0, fontWeight: 500 }}>{m.text}</p>
              </div>
            </div>
          );
        })}
        {t >= s.typing && (
          <div style={{ display: "flex", gap: 20, alignItems: "center", opacity: clamp01(typingK * 2) }}>
            <Head judge="tired" scale={1} />
            <div style={{ background: C.surface2, borderRadius: 26, padding: "22px 30px", display: "flex", gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: C.subtle, transform: `translateY(${-8 * Math.max(0, Math.sin((t - s.typing) * 9 - i * 0.9))}px)` }} />
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
      <Caption line={cap("7")} t={t} end={s.end} x={pick(a, 72, 1180)} y={pick(a, 1300, 420)} w={pick(a, 852, 640)} size={pick(a, 60, 68)} keys={["about", "you.", "right", "front"]} />
    </AbsoluteFill>
  );
}

const FIXES = [
  "Wire Twilio into onTurnClose in server/notify.ts and demo a real text.",
  "Replace the flat six minutes in estimateWait with the clinic's real pace.",
  "Cut “works offline” from the README until there's a service worker.",
];

function S8({ t }: { t: number }) {
  const a = useAspect();
  const s = S["8"];
  const frame = Math.round(t * FPS);
  const flip = sp(frame, s.flip, { damping: 15, stiffness: 160, mass: 0.9 });
  const push = 1 + 0.06 * prog(t, s.fixes[2] + 0.3, s.end, Easing.bezier(0.33, 0, 0.67, 1));
  const tall = a === "9x16";
  const fixesBlock = (
    <>
      <p style={{ ...labelStyle(24), margin: "0 0 22px" }}>fix before demos</p>
      {FIXES.map((f, i) => {
        const k = sp(frame, s.fixes[i], { damping: 14, stiffness: 240, mass: 0.6 });
        return (
          <div key={i} style={{ display: "flex", gap: 22, alignItems: "flex-start", marginTop: i ? 24 : 0, opacity: clamp01(k * 2), transform: `translateX(${(1 - k) * 70}px)` }}>
            <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 9, border: `3px solid ${C.borderStrong}`, marginTop: 4 }} />
            <p style={{ fontFamily: F.display, fontSize: 40, lineHeight: 1.2, color: C.text, margin: 0, fontWeight: 500 }}>{f}</p>
          </div>
        );
      })}
    </>
  );
  const verdict = (
    <>
      <p style={{ ...labelStyle(24) }}>review · latenight/queue-less</p>
      <p style={{ ...display(84), margin: "14px 0 0" }}>queue-less</p>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 12, marginTop: 22, fontFamily: F.mono, fontSize: 30, color: C.loss, border: `2px solid ${C.loss}`, background: "rgba(255,59,48,0.12)", padding: "8px 18px", borderRadius: 999 }}>✕ Changes requested</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 30 }}>
        <Odds value={34} size={190} />
        <div style={{ paddingBottom: 26 }}>
          <p style={{ ...labelStyle(24) }}>chance to win</p>
          <p style={{ fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.text, margin: "8px 0 0" }}>Honorable mention.</p>
        </div>
      </div>
    </>
  );
  return (
    <AbsoluteFill style={{ perspective: 2400 }}>
      <Cam scale={push} ox={pick(a, 500, 1300)} oy={pick(a, 1000, 500)}>
        <div style={{ position: "absolute", left: pick(a, 72, 120), width: pick(a, 852, 1680), top: pick(a, 280, 110), borderRadius: 32, border: `2px solid ${C.borderStrong}`, background: C.surface, padding: "40px 40px 44px", transform: `rotateX(${(1 - flip) * 75}deg)`, transformOrigin: "50% 0%", opacity: clamp01(flip * 2.5), boxShadow: "0 40px 120px rgba(0,0,0,0.55)", display: tall ? "block" : "flex", gap: 60 }}>
          <div style={{ flex: tall ? undefined : "0 0 700px" }}>{verdict}</div>
          {tall && <div style={{ height: 2, background: C.border, margin: "26px 0 26px" }} />}
          <div style={{ flex: 1, paddingTop: tall ? 0 : 12 }}>{fixesBlock}</div>
        </div>
      </Cam>
      <Caption line={cap("8")} t={t} end={s.end + ZOOM} x={pick(a, 72, 120)} y={pick(a, 1300, 790)} w={pick(a, 852, 1680)} size={pick(a, 56, 64)} keys={["exactly", "fix"]} />
    </AbsoluteFill>
  );
}

/** After this long past the landing, the reveal hands over to the static mark (logo.svg). */
export const LOGO_HANDOFF = 0.1;

/**
 * The mark's reveal, per part, at time t. Pixel2Motion choreography (brand/motion_spec.md):
 * anticipation (braces apart and compressed), action (braces slide home, the hook pops with
 * overshoot), follow-through (the dot drops and squashes once). Every part is exactly at rest
 * by logoLand + 0.07 s, so the handover to the static mark is invisible (Final Frame Contract).
 */
export function logoPartsAt(t: number) {
  const s = S["9"];
  const L = s.logo;
  const frame = Math.round(t * FPS);
  const braces = prog(t, L, L + 0.55, easeOut);
  // The hook's spring overshoots, then is blended to exactly 1 by the landing beat.
  // Overshoot ~1.08 at most (the brief's bound), from 0.55 so it reads as a pop, not a zoom.
  const hookSpring = 0.55 + 0.45 * sp(frame, L + 0.28, { damping: 12, stiffness: 240, mass: 0.6 });
  const settle = prog(t, s.logoLand - 0.25, s.logoLand, easeOut);
  const hook = hookSpring + (1 - hookSpring) * settle;
  const dotK = prog(t, L + 0.62, s.logoLand - 0.12, Easing.bezier(0.55, 0, 1, 0.45));
  const sq = clamp01((t - (s.logoLand - 0.12)) / 0.18);
  const squash = t >= s.logoLand - 0.12 && sq < 1 ? 1 - 0.18 * Math.sin(Math.PI * sq) : 1;
  return {
    "brace-left": { transform: `translateX(${-14 * (1 - braces)}px) scaleX(${0.9 + 0.1 * braces})`, opacity: clamp01(braces * 3) },
    "brace-right": { transform: `translateX(${14 * (1 - braces)}px) scaleX(${0.9 + 0.1 * braces})`, opacity: clamp01(braces * 3) },
    "question-hook": { transform: `translateY(${4 * (1 - clamp01(hook))}px) scale(${hook})`, opacity: clamp01((hook - 0.55) * 6), transformOrigin: "50% 100%" },
    // The dot drops a short way into the gap under the hook (never across it) and squashes once.
    "question-dot": { transform: `translateY(${-4 * (1 - dotK)}px) scale(${1 / squash}, ${squash})`, opacity: t < L + 0.62 ? 0 : clamp01(dotK * 4), transformOrigin: "50% 100%" },
  };
}

/** The Final Frame Contract check: the mark alone, animated parts at time t, or static. */
export function LogoContract({ mode }: { mode: "animated" | "static" }) {
  const t = S["9"].logoLand + LOGO_HANDOFF - 1 / FPS;
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Logo height={400} parts={mode === "animated" ? logoPartsAt(t) : {}} />
    </AbsoluteFill>
  );
}

function S9({ t }: { t: number }) {
  const a = useAspect();
  const s = S["9"];
  const frame = Math.round(t * FPS);
  const L = s.logo;
  const logoParts = logoPartsAt(t);
  const url = sp(frame, s.url, { damping: 16, stiffness: 200, mass: 0.7 });
  const sub = prog(t, s.sub, s.sub + 0.4, easeOut);
  const brand = TL.captions.filter((c) => c.scene === "9")[1];
  const said = brand?.words.find((w) => w.text.startsWith("wouldthiswin"))?.t ?? brand?.words[0].t ?? 0;
  const pulse = brand ? 1 + 0.04 * Math.sin(Math.PI * clamp01((t - said) / 0.35)) * (t >= said ? 1 : 0) : 1;
  const cx = pick(a, 72 + 852 / 2, 960);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: pick(a, 72 + (852 - 830) / 2, 960 - 415), top: pick(a, 320, 560), display: "flex", gap: 22 }}>
        {(["engineer", "investor", "tired"] as Judge[]).map((j, i) => {
          const k = sp(frame, s.start + i * 0.08, { damping: 15, stiffness: 200, mass: 0.7 });
          return <JudgeCard key={j} judge={j} scale={2} frame={blinking(j, t)} style={{ transform: `translateY(${Math.round((1 - k) * 60)}px)`, opacity: clamp01(k * 2) }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: cx - 138, top: pick(a, 680, 80) }}>
        <Logo height={200} parts={t >= s.logoLand + LOGO_HANDOFF ? {} : logoParts} />
      </div>
      <p style={{ position: "absolute", left: cx - 520, width: 1040, top: pick(a, 960, 320), textAlign: "center", ...display(pick(a, 92, 120)), transform: `scale(${pulse})` }}>
        <Mask k={url}>wouldthiswin.com</Mask>
      </p>
      <p style={{ position: "absolute", left: cx - 520, width: 1040, top: pick(a, 1090, 460), textAlign: "center", margin: 0, fontFamily: F.mono, fontSize: 46, color: C.muted, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)` }}>free. no sign-up.</p>
      <Caption line={cap("9")} t={t} end={s.end + 1} x={pick(a, 72, 560)} y={pick(a, 1300, 860)} w={pick(a, 852, 800)} size={72} align="center" keys={["yours", "win?"]} />
    </AbsoluteFill>
  );
}

const SCENES: Record<SceneKey, (p: { t: number }) => React.ReactElement> = { "1a": S1a, "1b": S1b, "2": S2, "3a": S3a, "3b": S3b, "4": S4, "5": S5, "6": S6, "7": S7, "8": S8, "9": S9 };

/** How each scene's light reads: red = trouble, blue = a gain. */
const GLOW: Record<SceneKey, { glow: number; tone: "loss" | "gain" | "neutral"; y: number }> = {
  "1a": { glow: 0.15, tone: "neutral", y: 42 },
  "1b": { glow: 0.55, tone: "loss", y: 50 },
  "2": { glow: 0.2, tone: "neutral", y: 55 },
  "3a": { glow: 0.45, tone: "loss", y: 62 },
  "3b": { glow: 0.9, tone: "loss", y: 42 },
  "4": { glow: 0.25, tone: "neutral", y: 30 },
  "5": { glow: 0.5, tone: "gain", y: 25 },
  "6": { glow: 0.12, tone: "neutral", y: 32 },
  "7": { glow: 0.18, tone: "neutral", y: 42 },
  "8": { glow: 0.35, tone: "loss", y: 30 },
  "9": { glow: 0.3, tone: "loss", y: 42 },
};

// ============================================================== transitions

/** Which transition brings each scene in (the rest are hard cuts on the beat). */
const IN: Partial<Record<SceneKey, "wipe" | "zoom">> = { "2": "wipe", "3a": "zoom", "6": "wipe", "7": "wipe", "9": "zoom" };

function Stage({ k, t }: { k: SceneKey; t: number }) {
  const Comp = SCENES[k];
  const g = GLOW[k];
  return (
    <AbsoluteFill>
      <Backdrop t={t} glow={g.glow} tone={g.tone} glowY={g.y} />
      <Comp t={t} />
    </AbsoluteFill>
  );
}

export function LaunchV2({ aspect, safeZones }: LaunchV2Props) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = Math.max(0, ORDER.findLastIndex((k) => t >= S[k].start));
  const cur = ORDER[i];
  const next = ORDER[i + 1];
  const layers: React.ReactNode[] = [];
  // Outgoing scene during a zoom-through: it flies into the camera.
  const nextIn = next ? IN[next] : undefined;
  if (next && nextIn === "zoom" && t >= S[next].start - ZOOM) {
    const z = prog(t, S[next].start - ZOOM, S[next].start, Easing.bezier(0.7, 0, 0.84, 0));
    layers.push(
      <AbsoluteFill key="out" style={{ transform: `scale(${1 + 2.2 * z})`, transformOrigin: next === "3a" ? `${pick(aspect, 498, 960)}px ${pick(aspect, 1110, 680)}px` : "50% 45%", filter: `blur(${z * 18}px)`, opacity: 1 - z }}>
        <Stage k={cur} t={t} />
      </AbsoluteFill>,
    );
  } else {
    layers.push(
      <AbsoluteFill key="cur">
        <Stage k={cur} t={t} />
      </AbsoluteFill>,
    );
  }
  // Incoming scene during a mask wipe: revealed bottom to top behind a red edge.
  if (next && nextIn === "wipe" && t >= S[next].start - WIPE) {
    const w = prog(t, S[next].start - WIPE, S[next].start, Easing.bezier(0.76, 0, 0.24, 1));
    const edge = (1 - w) * 100;
    layers.push(
      <AbsoluteFill key="in" style={{ clipPath: `inset(${edge}% 0 0 0)` }}>
        <Stage k={next} t={t} />
        <div style={{ position: "absolute", left: 0, right: 0, top: `${edge}%`, height: 6, background: C.loss, boxShadow: "0 0 24px rgba(255,59,48,0.8)" }} />
      </AbsoluteFill>,
    );
  }
  // The scene just after a zoom-through settles in from slightly small and soft.
  const curIn = IN[cur];
  const settle = curIn === "zoom" ? prog(t, S[cur].start, S[cur].start + 0.35, easeOut) : 1;
  return (
    <AspectCtx.Provider value={aspect}>
      <AbsoluteFill style={{ background: C.bg }}>
        {/* The end card has the judges on it: they don't scale, so it settles in by focus only. */}
        <AbsoluteFill style={settle < 1 ? { transform: cur === "9" ? undefined : `scale(${0.86 + 0.14 * settle})`, filter: `blur(${(1 - settle) * 10}px)` } : undefined}>{layers}</AbsoluteFill>
        <Grain frame={frame} />
        {safeZones && aspect === "9x16" && <SafeZones />}
      </AbsoluteFill>
    </AspectCtx.Provider>
  );
}
