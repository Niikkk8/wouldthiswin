"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { JudgeHead } from "@/components/judge-portrait";
import { AnimatedList } from "@/components/ui/animated-list";
import { Button } from "@/components/ui/button";
import { copy, fill } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { START_ODDS, toneOf, type OddsEvent, type Tone } from "@/lib/odds";
import type { Judge, SessionView } from "@/lib/session";
import type { Send } from "./session-shell";
import { ActFooter, ActTitle } from "./act-parts";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const DELTA: Record<Tone, string> = { gain: "text-gain", loss: "text-loss", unclear: "text-unclear", flat: "text-text-muted" };
const DOT: Record<Tone, string> = { gain: "#4D7CFF", loss: "#FF3B30", unclear: "#F5A524", flat: "#8A8A8E" };

const projectName = (repo: string) => repo.split("/").pop() ?? repo;
const CHART_MS = 1200;

/** The judge's head, cut from their portrait. */
export function Avatar({ judge, className }: { judge: Judge; className?: string }) {
  return <JudgeHead judge={judge} className={className} />;
}

function Typing({ judge }: { judge: Judge }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-end gap-3" aria-hidden>
      <Avatar judge={judge} />
      <div className="flex h-9 items-center gap-1 rounded-card bg-surface-2 px-3.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-text-subtle"
            animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

/** The odds after every event, drawn once; each dot pops in time with its row. */
function Replay({ events, instant }: { events: readonly OddsEvent[]; instant: boolean }) {
  const W = 385;
  const H = 150;
  const pts = [START_ODDS, ...events.map((e) => e.after)];
  const n = Math.max(1, pts.length - 1);
  const x = (i: number) => 6 + (i / n) * (W - 12);
  const y = (odds: number) => 6 + (1 - odds / 100) * (H - 12);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const at = (i: number) => (instant ? 0 : ((i + 1) / n) * (CHART_MS / 1000));
  const final = pts.at(-1)!;

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-6 w-full overflow-visible"
        role="img"
        aria-label={fill(copy.acts.deliberation.chart, { odds: final })}
      >
        <line x1={0} x2={W} y1={y(50)} y2={y(50)} stroke="#3A3A3E" strokeDasharray="3 5" />
        <motion.path
          d={d}
          fill="none"
          stroke="#F4F4F2"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={instant ? { opacity: 0 } : { pathLength: 0 }}
          animate={instant ? { opacity: 1 } : { pathLength: 1 }}
          transition={{ duration: instant ? 0.2 : CHART_MS / 1000, ease: "linear" }}
        />
        {events.map((e, i) => (
          <motion.circle
            key={i}
            cx={x(i + 1)}
            cy={y(e.after)}
            r={4}
            fill={DOT[toneOf(e)]}
            stroke="#0A0A0B"
            strokeWidth={2}
            initial={instant ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: instant ? 0.2 : 0.25, ease: EASE, delay: at(i) }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ))}
      </svg>
      <ol className="mt-6 grid gap-2.5">
        {events.map((e, i) => (
          <motion.li
            key={i}
            className="grid grid-cols-[48px_1fr] text-[16px] leading-snug"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: at(i) }}
          >
            <span className={cn("font-mono", DELTA[toneOf(e)])}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
            <span>{e.reason}</span>
          </motion.li>
        ))}
      </ol>
    </>
  );
}

/** Act 3, deliberation: the panel's chat (one model call, made here) and the night's replay. */
export function DeliberationAct({
  view,
  send,
  onNext,
  pending,
}: {
  view: SessionView;
  send: Send;
  onNext: () => void;
  pending: boolean;
}) {
  const reduce = !!useReducedMotion();
  const panel = view.panel;
  const [failed, setFailed] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const asking = useRef(false);

  const ask = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    // Another tab may be running it: wait and ask again, like the scan.
    for (;;) {
      const r = await send({ action: "deliberate" });
      if (!r.pending) {
        if (!r.ok) setFailed(true);
        break;
      }
      await new Promise((res) => setTimeout(res, 2500));
    }
    asking.current = false;
  }, [send]);

  // Started from a callback, and cancelled if the effect re-runs before it fires.
  useEffect(() => {
    if (panel) return;
    const t = setTimeout(() => void ask(), 0);
    return () => clearTimeout(t);
  }, [panel, ask]);

  const onDone = useCallback(() => setChatDone(true), []);
  const ready = !!panel && (chatDone || reduce);

  return (
    <>
      <ActTitle eyebrow={copy.acts.deliberation.eyebrow} title={copy.acts.deliberation.title} />
      <div className="mt-8 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_385px] lg:gap-16">
        <section className="rounded-panel border border-border bg-surface" aria-live="polite" aria-busy={!panel}>
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-[17px] font-bold">
              {fill(copy.acts.deliberation.channel, { name: projectName(view.repo) })}
            </h2>
            <p className="label-mono">{copy.acts.deliberation.readOnly}</p>
          </header>
          <div className="min-h-[320px] px-5 py-6">
            {panel ? (
              <AnimatedList
                instant={reduce}
                delay={900}
                onDone={onDone}
                typing={(i) => panel.chat[i] && <Typing judge={panel.chat[i].judge} />}
              >
                {panel.chat.map((m, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <Avatar judge={m.judge} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-text-subtle">{copy.judges[m.judge].name}</p>
                      <p className="mt-1 w-fit rounded-card bg-surface-2 px-3.5 py-2 text-[16px] leading-snug">{m.text}</p>
                    </div>
                  </div>
                ))}
              </AnimatedList>
            ) : failed ? (
              <div className="grid justify-items-start gap-4">
                <p className="text-[17px] text-text-muted">{copy.acts.deliberation.failed}</p>
                <Button variant="secondary" onClick={() => {
                    setFailed(false);
                    void ask();
                  }} disabled={pending}>
                  {copy.acts.deliberation.retry}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                <Typing judge="engineer" />
                <p className="label-mono" role="status">
                  {copy.acts.deliberation.deliberating}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Clears the odds widget and its chip above it on desktop. */}
        <section className="lg:pt-10">
          <h2 className="label-mono uppercase">{copy.acts.deliberation.night}</h2>
          <Replay events={view.events} instant={reduce} />
        </section>
      </div>
      {ready && <ActFooter label={copy.acts.deliberation.next} onClick={onNext} disabled={pending} />}
    </>
  );
}
