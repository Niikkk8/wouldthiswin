// The launch video's scenes, rebuilt from the app's pieces as layers. Each scene is a pure
// function of its state props (how much is typed, which beam is red, where the camera is),
// so the style frames pose them and the animated cut drives the same props from the frame.

import React from "react";
import { AbsoluteFill } from "remotion";
import { C, COL, F, Head, JUDGE_NAME, JudgeCard, Logo, Mask, SAFE, W, label, type Judge } from "./kit";

// ---------------------------------------------------------------- shared pieces

const displayStyle = (size: number, weight = 900): React.CSSProperties => ({
  fontFamily: F.display,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 0.94,
  letterSpacing: "-0.045em",
  color: C.text,
  margin: 0,
});

/** A caption, word by word: each word rises out of a mask, the key words heavier. */
export function KineticCaption({ words, k, top, size = 64, align = "left" }: { words: { w: string; key?: boolean; accent?: boolean }[]; k: number[]; top: number; size?: number; align?: "left" | "center" }) {
  return (
    <div style={{ position: "absolute", left: COL.x, width: COL.w, top, textAlign: align }}>
      <p style={{ ...displayStyle(size, 800), lineHeight: 1.08, letterSpacing: "-0.035em" }}>
        {words.map((x, i) => (
          <React.Fragment key={i}>
            <Mask k={k[i] ?? 1}>
              <span style={{ fontWeight: x.key ? 900 : 700, color: x.accent ? C.loss : x.key ? C.text : C.muted }}>{x.w}</span>
            </Mask>{" "}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

/** The live odds, as the app draws them (Archivo 900, tight), any size. */
function Odds({ value, size, color = C.text }: { value: number; size: number; color?: string }) {
  return <span style={{ ...displayStyle(size), letterSpacing: "-0.05em", color, display: "inline-block" }}>{Math.round(value)}%</span>;
}

/** The delta chip: the change and its reason, in the event's tone. */
function Chip({ delta, reason, tone, size = 34 }: { delta: string; reason: string; tone: "loss" | "gain"; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 18, alignItems: "center", fontFamily: F.mono, fontSize: size, padding: `${size * 0.32}px ${size * 0.6}px`, borderRadius: 12, background: tone === "loss" ? C.loss : C.gain, color: C.bg, fontWeight: 500 }}>
      <span>{delta}</span>
      <span>{reason}</span>
    </span>
  );
}

/** Words of a sentence, the first `shown` solid and the rest ghosted (typing, word by word). */
function Typed({ text, shown, caught, style }: { text: string; shown: number; caught?: string; style: React.CSSProperties }) {
  const words = text.split(" ");
  const caughtWords = caught ? caught.split(" ") : [];
  const at = caught ? words.findIndex((_, i) => caughtWords.every((c, j) => words[i + j]?.replace(/[.,?]/g, "") === c)) : -1;
  return (
    <p style={style}>
      {words.map((w, i) => {
        const isCaught = at >= 0 && i >= at && i < at + caughtWords.length;
        const on = i < shown;
        return (
          <React.Fragment key={i}>
            <span
              style={{
                color: isCaught ? C.loss : C.text,
                opacity: on ? 1 : 0.14,
                textDecoration: isCaught && on ? "underline" : "none",
                textDecorationThickness: "0.07em",
                textUnderlineOffset: "0.12em",
              }}
            >
              {w}
            </span>{" "}
          </React.Fragment>
        );
      })}
    </p>
  );
}

function Caret({ h, on = true }: { h: number; on?: boolean }) {
  return <span style={{ display: "inline-block", width: Math.max(3, h * 0.07), height: h, background: C.text, marginLeft: 4, verticalAlign: "text-bottom", opacity: on ? 1 : 0 }} />;
}

// ---------------------------------------------------------------- 1. the hook

export function S1Hook({ k = [1, 1, 1, 1, 1, 1, 1, 1] }: { k?: number[] }) {
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: COL.x, top: SAFE.top + 60, display: "flex", alignItems: "center", gap: 16 }}>
        <Logo height={40} />
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, letterSpacing: "-0.03em", color: C.text }}>wouldthiswin</span>
      </div>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: 520 }}>
        <p style={{ ...displayStyle(60, 700), color: C.muted, letterSpacing: "-0.03em" }}>
          {"the night before submission,".split(" ").map((w, i) => (
            <React.Fragment key={i}>
              <Mask k={k[i]}>{w}</Mask>{" "}
            </React.Fragment>
          ))}
        </p>
        <p style={{ ...displayStyle(136), marginTop: 36 }}>
          {["every team", "asks one", "question"].map((line, li) => (
            <span key={li} style={{ display: "block" }}>
              <Mask k={k[4 + li] ?? 1}>{line}</Mask>
            </span>
          ))}
        </p>
      </div>
    </AbsoluteFill>
  );
}

export function S1Slam({ slam = 1 }: { slam?: number }) {
  // `slam` 0→1: the words land from big and blurred to set; the ? hits last, in red.
  const lines: [string, string?][] = [["would"], ["this"], ["win", "?"]];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: COL.x, top: 360 }}>
        {lines.map(([w, q], i) => (
          <p key={i} style={{ ...displayStyle(250), lineHeight: 0.86, transform: `scale(${1 + (1 - slam) * 0.35})`, transformOrigin: "0% 50%" }}>
            {w}
            {q && <span style={{ color: C.loss, textShadow: "0 0 60px rgba(255,59,48,0.45)" }}>{q}</span>}
          </p>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** The panel, small, watching: the hook's bottom third. */
export function PanelRow({ top, dim = 0.5, frames = {} }: { top: number; dim?: number; frames?: Partial<Record<Judge, string>> }) {
  return (
    <div style={{ position: "absolute", left: COL.x, top, display: "flex", gap: 24 }}>
      {(["engineer", "investor", "tired"] as Judge[]).map((j) => (
        <JudgeCard key={j} judge={j} scale={2} dim={dim} frame={frames[j]} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 2. the repo

export function S2Repo({ typed = "github.com/latenight/queue-less", pressed = 1, push = 1.04 }: { typed?: string; pressed?: number; push?: number }) {
  const btnY = 1040;
  return (
    <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: `${COL.x + COL.w / 2}px ${btnY + 70}px` }}>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: 560 }}>
        <p style={{ ...displayStyle(112), color: C.text, opacity: 0.22 }}>
          Would this
          <br />
          win?
        </p>
      </div>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: 820 }}>
        <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 34, color: C.muted, margin: "0 0 18px" }}>Your GitHub repo</p>
        <div style={{ height: 140, borderRadius: 22, border: `3px solid ${C.text}`, background: C.surface, display: "flex", alignItems: "center", padding: "0 34px", boxShadow: "0 0 0 8px rgba(244,244,242,0.06)" }}>
          <span style={{ fontFamily: F.mono, fontSize: 40, color: C.text, whiteSpace: "nowrap" }}>{typed}</span>
          <Caret h={56} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: COL.x,
          width: COL.w,
          top: btnY,
          height: 140,
          borderRadius: 22,
          background: C.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${1 - 0.04 * pressed})`,
          filter: `brightness(${1 - 0.12 * pressed})`,
        }}
      >
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 52, letterSpacing: "-0.03em", color: C.bg }}>Face the panel</span>
      </div>
      <p style={{ position: "absolute", left: COL.x, width: COL.w, top: 1210, fontFamily: F.display, fontSize: 30, color: C.subtle, margin: 0 }}>About 4 minutes. 3 questions, 30 seconds each.</p>
    </AbsoluteFill>
  );
}

export function S2Caption({ k = [1, 1, 1] }: { k?: number[] }) {
  return (
    <AbsoluteFill>
      <KineticCaption top={1330} size={72} k={k} words={[{ w: "paste" }, { w: "your" }, { w: "repo.", key: true }]} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- 3. the scan

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
const ROW = 54;
const TREE_TOP = 720;
const TREE_X = COL.x + 8;
const MONO_W = 0.6 * 36; // JetBrains Mono advance at 36px

export function S3Scan({ files = TREE.length, beams = [1, 1, 1], red = 1, found = 1 }: { files?: number; beams?: number[]; red?: number; found?: number }) {
  // The SMS claim searches three files; the last one, notify.ts, only logs: the beam turns red.
  const targets = [1, 8, 9]; // package.json, queue.ts, notify.ts
  const start = { x: COL.x + COL.w - 48, y: 598 };
  return (
    <AbsoluteFill>
      <p style={{ ...label, position: "absolute", left: COL.x, top: SAFE.top + 40, margin: 0 }}>the scan · readme claims</p>
      <div
        style={{
          position: "absolute",
          left: COL.x,
          width: COL.w,
          top: 360,
          borderRadius: 24,
          padding: "30px 34px",
          border: `3px solid ${red > 0.5 ? C.loss : C.borderStrong}`,
          background: red > 0.5 ? "rgba(255,59,48,0.10)" : C.surface,
        }}
      >
        <p style={{ fontFamily: F.display, fontWeight: 800, fontSize: 46, letterSpacing: "-0.03em", color: C.text, margin: 0, lineHeight: 1.08 }}>SMS alerts when your turn is close</p>
        <p style={{ fontFamily: F.mono, fontSize: 30, color: red > 0.5 ? C.loss : C.subtle, margin: "16px 0 0" }}>{red > 0.5 ? "onTurnClose logs instead of sending" : "searching the code…"}</p>
      </div>
      <p style={{ ...label, position: "absolute", left: COL.x, top: TREE_TOP - 64, margin: 0, fontSize: 26 }}>latenight/queue-less</p>
      {TREE.slice(0, files).map((f, i) => {
        const hit = targets.indexOf(i);
        const isRed = i === 9 && red > 0.5;
        const focus = hit >= 0 || f.dir;
        return (
          <p
            key={f.name}
            style={{
              position: "absolute",
              left: TREE_X + f.depth * 44,
              top: TREE_TOP + i * ROW,
              margin: 0,
              fontFamily: F.mono,
              fontSize: 36,
              color: isRed ? C.loss : hit >= 0 ? C.text : f.dir ? C.muted : C.subtle,
              opacity: focus ? 1 : 0.38,
              filter: focus ? undefined : "blur(1.2px)",
            }}
          >
            {f.dir ? "▾ " : ""}
            {f.name}
          </p>
        );
      })}
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {targets.map((ti, n) => {
          const f = TREE[ti];
          const endX = TREE_X + f.depth * 44 + f.name.length * MONO_W + 22;
          const endY = TREE_TOP + ti * ROW + 24;
          const isRed = n === 2 && red > 0.5;
          const d = `M ${start.x} ${start.y} C ${start.x} ${start.y + 160}, ${endX + 260} ${endY}, ${endX} ${endY}`;
          return (
            <g key={ti}>
              <path d={d} fill="none" stroke={isRed ? C.loss : C.text} strokeOpacity={isRed ? 1 : 0.55} strokeWidth={isRed ? 5 : 3} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - (beams[n] ?? 1)} style={{ filter: isRed ? "drop-shadow(0 0 12px rgba(255,59,48,0.8))" : undefined }} />
              <circle cx={endX} cy={endY} r={isRed ? 9 : 6} fill={isRed ? C.loss : C.text} opacity={(beams[n] ?? 1) >= 1 ? 1 : 0} />
            </g>
          );
        })}
        <circle cx={start.x} cy={start.y} r={8} fill={red > 0.5 ? C.loss : C.text} />
      </svg>
      <KineticCaption top={1340} size={64} k={[1, 1, 1, 1, 1]} words={[{ w: "it" }, { w: "reads" }, { w: "your" }, { w: "actual", key: true }, { w: "code.", key: true }]} />
      {found > 0 && (
        <div style={{ position: "absolute", left: TREE_X + 44 + "notify.ts".length * MONO_W + 52, top: TREE_TOP + 9 * ROW - 6, transform: `scale(${0.6 + 0.4 * found}) rotate(-3deg)`, transformOrigin: "0% 50%", opacity: found }}>
          <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 32, color: C.bg, background: C.loss, padding: "6px 14px", borderRadius: 8, letterSpacing: "0.04em" }}>NOT FOUND: SMS</span>
        </div>
      )}
    </AbsoluteFill>
  );
}

export function S3Odds({ value = 31, was = 50, flash = 0.6 }: { value?: number; was?: number; flash?: number }) {
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 55% at 45% 45%, rgba(255,59,48,${0.32 * flash}) 0%, rgba(255,59,48,0) 70%)` }} />
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: 470 }}>
        <p style={{ ...label, margin: 0 }}>chance to win</p>
        <p style={{ margin: "26px 0 0", fontFamily: F.mono, fontSize: 84, color: C.subtle, textDecoration: "line-through", textDecorationThickness: 6 }}>{was}%</p>
        <div style={{ marginTop: 6, marginLeft: -14 }}>
          <Odds value={value} size={330} color={C.loss} />
        </div>
        <div style={{ marginTop: 40 }}>
          <Chip delta="-19" reason="SMS claim unbacked" tone="loss" size={38} />
        </div>
      </div>
      <KineticCaption top={1300} size={72} k={[1, 1, 1, 1, 1]} words={[{ w: "and" }, { w: "your" }, { w: "odds" }, { w: "move." }, { w: "live.", key: true, accent: true }]} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- 4. the panel

const Q1 = "Your README promises SMS alerts when your turn is close. Which file sends one?";

export function S4Panel({ shown = 11, engineerScale = 4, talking = true, capK = [1, 1, 1, 1, 1, 1, 1, 1, 1] }: { shown?: number; engineerScale?: number; talking?: boolean; capK?: number[] }) {
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: COL.x, top: SAFE.top + 30, display: "flex", gap: 24, alignItems: "flex-start" }}>
        <JudgeCard judge="engineer" scale={engineerScale} frame={talking ? "talk" : "base"} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <JudgeCard judge="investor" scale={2} dim={0.7} />
          <JudgeCard judge="tired" scale={2} dim={0.7} />
        </div>
      </div>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: 850 }}>
        <p style={{ ...label, margin: 0, color: C.text, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 16, height: 16, borderRadius: 8, background: C.loss, display: "inline-block" }} />
          {JUDGE_NAME.engineer}
          <span style={{ marginLeft: "auto", fontSize: 44, letterSpacing: 0, color: C.text }}>0:30</span>
        </p>
        <Typed text={Q1} shown={shown} caught="SMS alerts" style={{ ...displayStyle(70, 800), lineHeight: 1.04, letterSpacing: "-0.035em", marginTop: 26 }} />
      </div>
      <KineticCaption top={1300} size={54} k={capK} words={[{ w: "then" }, { w: "three", key: true }, { w: "judges", key: true }, { w: "grill", key: true }, { w: "you." }, { w: "thirty" }, { w: "seconds" }, { w: "a" }, { w: "question." }]} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- 5. the answer

const A1 = "None yet. The turn-close event fires, but Twilio isn't wired. That's tonight's job.";

export function S5Answer({ typed = A1.length, odds = 36 }: { typed?: number; odds?: number }) {
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: SAFE.top + 30, display: "flex", alignItems: "flex-end", gap: 26 }}>
        <Odds value={odds} size={180} />
        <div style={{ paddingBottom: 22 }}>
          <p style={{ margin: "0 0 12px", fontFamily: F.mono, fontSize: 40, color: C.subtle, textDecoration: "line-through" }}>31%</p>
          <Chip delta="+5" reason="straight answer" tone="gain" size={32} />
        </div>
      </div>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: 520, borderRadius: 24, border: `3px solid ${C.borderStrong}`, background: C.surface, padding: "28px 32px" }}>
        <p style={{ ...label, fontSize: 24, margin: "0 0 14px" }}>your answer · 0:24</p>
        <p style={{ fontFamily: F.mono, fontSize: 38, lineHeight: 1.35, color: C.text, margin: 0 }}>
          {A1.slice(0, typed)}
          <Caret h={46} />
        </p>
      </div>
      <div style={{ position: "absolute", left: COL.x, top: 930, display: "flex", gap: 24, alignItems: "flex-end" }}>
        <JudgeCard judge="investor" scale={3} frame="impressed" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <JudgeCard judge="engineer" scale={1} dim={0.7} />
          <JudgeCard judge="tired" scale={1} dim={0.7} />
        </div>
      </div>
      <p style={{ ...label, position: "absolute", left: COL.x, top: 1340, margin: 0, color: C.gain }}>the investor perks up</p>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- 6. the tired judge

export function S6Tired({ frame = "dozing", z = 1, capK = [1, 1, 1, 1, 1, 1] }: { frame?: string; z?: number; capK?: number[] }) {
  const left = COL.x + (COL.w - 518) / 2;
  return (
    <AbsoluteFill>
      <p style={{ ...label, position: "absolute", left: COL.x, top: SAFE.top + 30, margin: 0 }}>question 3 of 3 · {JUDGE_NAME.tired}</p>
      <div style={{ position: "absolute", left, top: 360 }}>
        <JudgeCard judge="tired" scale={4} frame={frame} />
      </div>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ position: "absolute", left: left + 470 + i * 46, top: 380 - i * 58, fontFamily: F.display, fontWeight: 900, fontSize: 56 + i * 14, color: C.muted, opacity: z * (1 - i * 0.18) }}>
          z
        </span>
      ))}
      <p style={{ position: "absolute", left: COL.x, width: COL.w, top: 930, ...displayStyle(64, 800), opacity: 0.32 }}>
        <span style={{ color: C.loss }}>In one sentence.</span> What is it?
      </p>
      <p style={{ position: "absolute", left: COL.x, top: 1060, margin: 0, fontFamily: F.mono, fontSize: 96, color: C.subtle }}>0:19</p>
      <KineticCaption top={1330} size={64} k={capK} words={[{ w: "one" }, { w: "of" }, { w: "them" }, { w: "is" }, { w: "very" }, { w: "tired.", key: true }]} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- 7. deliberation

const CHAT: { judge: Judge; text: string }[] = [
  { judge: "tired", text: "the qr code thing. which one was that again." },
  { judge: "engineer", text: "queue.ts is real. notify.ts logs “turn close” and stops." },
  { judge: "investor", text: "Clinics paying per location is a real model. Two maybes is not traction." },
  { judge: "engineer", text: "Credit for saying it straight." },
];

export function Bubble({ judge, text, k = 1 }: { judge: Judge; text: string; k?: number }) {
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", opacity: k, transform: `translateY(${(1 - k) * 40}px) scale(${0.94 + 0.06 * k})`, transformOrigin: "0% 0%" }}>
      <Head judge={judge} scale={1} />
      <div style={{ background: C.surface2, borderRadius: "8px 26px 26px 26px", padding: "18px 26px 22px", maxWidth: 720, border: `2px solid ${C.border}` }}>
        <p style={{ fontFamily: F.mono, fontSize: 24, color: C.subtle, margin: "0 0 6px", textTransform: "lowercase" }}>{JUDGE_NAME[judge]}</p>
        <p style={{ fontFamily: F.display, fontSize: 42, lineHeight: 1.2, color: C.text, margin: 0, fontWeight: 500 }}>{text}</p>
      </div>
    </div>
  );
}

export function S7Chat({ shown = CHAT.length, typing = 1, capK = [1, 1, 1, 1, 1, 1, 1] }: { shown?: number; typing?: number; capK?: number[] }) {
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: SAFE.top + 30 }}>
        <p style={{ fontFamily: F.mono, fontSize: 36, color: C.text, fontWeight: 700, margin: 0 }}>#panel-queue-less</p>
        <p style={{ fontFamily: F.mono, fontSize: 26, color: C.subtle, margin: "8px 0 0" }}>you can read this. you can't reply.</p>
      </div>
      <div style={{ position: "absolute", left: COL.x, width: COL.w, top: 400, display: "flex", flexDirection: "column", gap: 24 }}>
        {CHAT.slice(0, shown).map((m, i) => (
          <Bubble key={i} judge={m.judge} text={m.text} />
        ))}
        {typing > 0 && (
          <div style={{ display: "flex", gap: 20, alignItems: "center", opacity: typing }}>
            <Head judge="tired" scale={1} />
            <div style={{ background: C.surface2, borderRadius: 26, padding: "22px 30px", display: "flex", gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: C.subtle, opacity: 0.5 + 0.25 * i }} />
              ))}
            </div>
          </div>
        )}
      </div>
      <KineticCaption top={1300} size={60} k={capK} words={[{ w: "they" }, { w: "talk" }, { w: "about", key: true }, { w: "you.", key: true }, { w: "in" }, { w: "front" }, { w: "of" }, { w: "you.", key: true }]} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- 8. the review

const FIXES = [
  "Wire Twilio into onTurnClose in server/notify.ts and demo a real text.",
  "Replace the flat six minutes in estimateWait with the clinic's real pace.",
  "Cut “works offline” from the README until there's a service worker.",
];

export function S8Review({ flip = 1, fixes = [1, 1, 1] }: { flip?: number; fixes?: number[] }) {
  return (
    <AbsoluteFill style={{ perspective: 2400 }}>
      <div
        style={{
          position: "absolute",
          left: COL.x,
          width: COL.w,
          top: SAFE.top + 30,
          borderRadius: 32,
          border: `2px solid ${C.borderStrong}`,
          background: C.surface,
          padding: "40px 40px 44px",
          transform: `rotateX(${(1 - flip) * 70}deg)`,
          transformOrigin: "50% 0%",
          boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
        }}
      >
        <p style={{ ...label, fontSize: 24, margin: 0 }}>review · latenight/queue-less</p>
        <p style={{ ...displayStyle(84), margin: "14px 0 0" }}>queue-less</p>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, marginTop: 22, fontFamily: F.mono, fontSize: 30, color: C.loss, border: `2px solid ${C.loss}`, background: "rgba(255,59,48,0.12)", padding: "8px 18px", borderRadius: 999 }}>✕ Changes requested</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 30 }}>
          <Odds value={34} size={190} />
          <div style={{ paddingBottom: 26 }}>
            <p style={{ ...label, fontSize: 24, margin: 0 }}>chance to win</p>
            <p style={{ fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.text, margin: "8px 0 0" }}>Honorable mention.</p>
          </div>
        </div>
        <div style={{ height: 2, background: C.border, margin: "26px 0 26px" }} />
        <p style={{ ...label, fontSize: 24, margin: "0 0 22px" }}>fix before demos</p>
        {FIXES.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 22, alignItems: "flex-start", marginTop: i ? 24 : 0, opacity: fixes[i], transform: `translateX(${(1 - fixes[i]) * 60}px)` }}>
            <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 9, border: `3px solid ${C.borderStrong}`, marginTop: 4 }} />
            <p style={{ fontFamily: F.display, fontSize: 40, lineHeight: 1.2, color: C.text, margin: 0, fontWeight: 500 }}>{f}</p>
          </div>
        ))}
      </div>
      <KineticCaption top={1300} size={56} k={[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]} words={[{ w: "and" }, { w: "tell" }, { w: "you" }, { w: "exactly", key: true }, { w: "what" }, { w: "to" }, { w: "fix", key: true }, { w: "before" }, { w: "you" }, { w: "submit." }]} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- 9. the end card

export function S9End({ url = 1, sub = 1, blink = {} }: { url?: number; sub?: number; blink?: Partial<Record<Judge, string>> }) {
  const cx = COL.x + COL.w / 2;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: COL.x + (COL.w - (3 * 262 + 2 * 22)) / 2, top: SAFE.top + 70, display: "flex", gap: 22 }}>
        {(["engineer", "investor", "tired"] as Judge[]).map((j) => (
          <JudgeCard key={j} judge={j} scale={2} frame={blink[j]} />
        ))}
      </div>
      <div style={{ position: "absolute", left: cx - 138, top: 680 }}>
        <Logo height={200} />
      </div>
      <p style={{ position: "absolute", left: COL.x, width: COL.w, top: 960, textAlign: "center", ...displayStyle(92) }}>
        <Mask k={url}>wouldthiswin.com</Mask>
      </p>
      <p style={{ position: "absolute", left: COL.x, width: COL.w, top: 1090, textAlign: "center", margin: 0, fontFamily: F.mono, fontSize: 46, color: C.muted, opacity: sub }}>free. no sign-up.</p>
      <KineticCaption top={1300} size={72} align="center" k={[1, 1, 1]} words={[{ w: "would" }, { w: "yours" , key: true }, { w: "win?", key: true }]} />
    </AbsoluteFill>
  );
}
