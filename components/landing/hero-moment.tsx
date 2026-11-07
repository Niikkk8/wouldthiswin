"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { JudgePortrait } from "@/components/judge-portrait";
import { SampleTag } from "@/components/landing/sample-tag";
import { OddsWidget } from "@/components/odds-widget";
import { copy } from "@/lib/copy";
import { DEMO_SCAN } from "@/lib/demo/fixture";
import type { Reaction } from "@/lib/judge-sprites";
import { EASE } from "@/lib/motion";
import { makeEvent, type OddsEvent } from "@/lib/odds";
import type { Judge } from "@/lib/session";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const MOMENT_MS = 6000;
const WORD_MS = 110;
const TICK_MS = 100;
/** The hero form's fields: while one has focus, the loop holds still. */
const FORM_FIELDS = ["repo", "repo-demo"];

const ORDER: readonly Judge[] = ["engineer", "investor", "tired"];
const question = (j: Judge) => DEMO_SCAN.questions.find((q) => q.judge === j)!.text;

// The sample's odds: the SMS claim isn't in the code (50 → 31), then the clinic pays (31 → 36).
const sms = DEMO_SCAN.claims.find((c) => c.claim.startsWith("SMS"))!;
const DROP = makeEvent([], { act: 1, kind: "claim", status: "unbacked", rawDelta: -19, reason: sms.label });
const PAYS = makeEvent([DROP], { act: 2, kind: "answer", rawDelta: 5, reason: copy.landing.moment.paysReason });

type Moment = {
  judge: Judge;
  /** When the bubble appears and the question starts typing, ms into the moment. */
  askAt: number;
  /** A face held from `at` until `until` (or the end of the moment). */
  pose?: { kind: Exclude<Reaction, "scan">; at: number; until?: number };
  /** The Tired Judge sleeps until this. */
  dozeUntil?: number;
  /** The odds after this moment's event, and when it lands. */
  event?: { at: number; events: OddsEvent[] };
  before: OddsEvent[];
};

const MOMENTS: Moment[] = [
  { judge: "engineer", askAt: 300, pose: { kind: "drop", at: 2500 }, event: { at: 2500, events: [DROP] }, before: [] },
  { judge: "investor", askAt: 300, pose: { kind: "gain", at: 2300 }, event: { at: 2300, events: [DROP, PAYS] }, before: [DROP] },
  { judge: "tired", askAt: 2500, dozeUntil: 1700, pose: { kind: "gain", at: 1700, until: 2500 }, before: [DROP, PAYS] },
];
const LOOP_MS = MOMENTS.length * MOMENT_MS;
/** Reduced motion: moment 1, after the odds have dropped. */
const STILL_MS = 5000;

/** Time through the loop, counting only while the visitor isn't typing in the form. */
function useLoopClock(run: boolean, box: React.RefObject<HTMLElement | null>): number {
  const [t, setT] = useState(0);
  const typing = useRef(false);
  const visible = useRef(true);
  useEffect(() => {
    if (!run) return;
    const sync = () => {
      typing.current = FORM_FIELDS.includes(document.activeElement?.id ?? "");
    };
    sync();
    document.addEventListener("focusin", sync);
    // On focusout the next field isn't focused yet; check once it is.
    const later = () => setTimeout(sync);
    document.addEventListener("focusout", later);
    // Scrolled away: nothing to watch, so nothing to run.
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
    });
    if (box.current) io.observe(box.current);

    // Starts once the page has loaded and the main thread is free, so the loop never
    // competes with the hero's first paint or the page becoming interactive.
    let id: ReturnType<typeof setInterval> | undefined;
    // Safari has no requestIdleCallback: a short timeout stands in.
    const ric = typeof window.requestIdleCallback === "function";
    let idle: number | undefined;
    let last = 0;
    const begin = () => {
      last = performance.now();
      id = setInterval(() => {
        const now = performance.now();
        // A background tab can stall the timer for seconds; never skip ahead more than a tick.
        const dt = Math.min(now - last, TICK_MS * 4);
        last = now;
        if (!typing.current && visible.current) setT((x) => x + dt);
      }, TICK_MS);
    };
    const whenIdle = () => {
      idle = ric ? window.requestIdleCallback(begin, { timeout: 2000 }) : (setTimeout(begin, 600) as unknown as number);
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      clearInterval(id);
      if (idle !== undefined) {
        if (ric) window.cancelIdleCallback(idle);
        else clearTimeout(idle);
      }
      window.removeEventListener("load", whenIdle);
      io.disconnect();
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", later);
    };
  }, [run, box]);
  return run ? t : STILL_MS;
}

/**
 * The hero's right side: a sample moment from the panel, looping. The speaking judge is big,
 * their question types out, and the odds move. Holds still while you type your repo.
 */
export function HeroMoment({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLElement>(null);
  const t = useLoopClock(!reduce, box);
  const loop = Math.floor(t / LOOP_MS);
  const index = Math.floor((t % LOOP_MS) / MOMENT_MS);
  const local = t % MOMENT_MS;
  const m = MOMENTS[index];

  const text = question(m.judge);
  const words = text.split(" ");
  const asking = local >= m.askAt;
  const shown = Math.min(words.length, Math.max(0, Math.floor((local - m.askAt) / WORD_MS) + 1));
  const talking = asking && local < m.askAt + words.length * WORD_MS + 150;
  const pose = m.pose && local >= m.pose.at && local < (m.pose.until ?? Infinity) ? m.pose.kind : null;
  const dozing = m.dozeUntil !== undefined && local < m.dozeUntil;
  const events = m.event && local >= m.event.at ? m.event.events : m.before;
  const others = ORDER.filter((j) => j !== m.judge);

  return (
    <figure ref={box} className={cn("w-full max-w-[544px] xl:max-w-[448px] 2xl:max-w-[544px]", className)} aria-label={copy.landing.moment.describe}>
      <div aria-hidden>
        <SampleTag>{copy.landing.moment.label}</SampleTag>

        <div className="mt-5 flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:gap-6">
          {/* Three lines high whatever the question, so nothing below moves. */}
          <div className="relative min-h-[104px] min-w-0 flex-1">
            <AnimatePresence>
              {asking && (
                <motion.div
                  key={`${loop}-${index}`}
                  className="absolute inset-x-0 bottom-0 rounded-card border border-border-strong bg-surface-2 px-4 py-3"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  <p className="label-mono">{copy.judges[m.judge].name}</p>
                  <p className="mt-1 text-[17px] leading-snug font-bold">
                    {words.map((w, i) => (
                      <span key={i} className={cn("transition-colors duration-150", i < shown ? "text-text" : "text-text-subtle/40")}>
                        {w}{" "}
                      </span>
                    ))}
                  </p>
                  <span className="absolute top-full left-12 -mt-[5px] size-2.5 rotate-45 border-r border-b border-border-strong bg-surface-2" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <OddsWidget
            key={loop}
            events={events}
            className="static! m-0! shrink-0 border-0! bg-transparent! p-0!"
          />
        </div>

        <ul className="mt-4 flex items-end gap-2 sm:gap-4 xl:gap-2 2xl:gap-4">
          <li className="min-w-0">
            <div className="overflow-hidden rounded-card border border-border-strong">
              <JudgePortrait key={`s-${m.judge}`} judge={m.judge} size={128} talking={talking} pose={pose} dozing={dozing} label={false} className="sm:hidden" />
              <JudgePortrait key={`l-${m.judge}`} judge={m.judge} size={256} talking={talking} pose={pose} dozing={dozing} label={false} className="max-sm:hidden" />
            </div>
          </li>
          {others.map((j) => (
            <li key={j} className="min-w-0 opacity-80">
              {/* Narrow windows trim the shoulders, never the face, where the row would crowd the text. */}
              <div className="w-[96px] overflow-hidden rounded-card border border-border sm:w-auto xl:w-[88px] 2xl:w-auto">
                <JudgePortrait judge={j} size={128} label={false} className="-mx-4 sm:mx-0 xl:-mx-5 2xl:mx-0" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
