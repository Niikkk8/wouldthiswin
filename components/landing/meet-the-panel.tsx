"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { JudgePortrait } from "@/components/judge-portrait";
import { copy } from "@/lib/copy";
import type { Judge } from "@/lib/session";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const ORDER: readonly Judge[] = ["engineer", "investor", "tired"];
const WORD_MS = 90;

/** How many words of `text` are showing: all of them, then counting up from 0 once `on`. */
function useTyping(text: string, on: boolean, instant: boolean): { shown: number; total: number; typing: boolean } {
  const total = text.split(" ").length;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!on || instant) return;
    let n = 0;
    const t = setInterval(() => {
      n++;
      setShown(n);
      if (n >= total) clearInterval(t);
    }, WORD_MS);
    return () => {
      clearInterval(t);
      setShown(0);
    };
  }, [on, instant, total]);
  const count = !on || instant ? total : shown;
  return { shown: count, total, typing: on && !instant && shown < total };
}

function JudgeCard({ judge }: { judge: Judge }) {
  const reduce = useReducedMotion();
  const j = copy.judges[judge];
  const [on, setOn] = useState(false);
  const { shown, typing } = useTyping(j.sample, on, reduce);
  const words = j.sample.split(" ");

  return (
    <li
      className="grid content-start rounded-panel border border-border bg-surface p-5 sm:p-6"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOn(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOn(false)}
    >
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${j.name}: ${copy.landing.meet.hint}`}
        className="w-fit overflow-hidden rounded-card border border-border transition-colors hover:border-border-strong aria-pressed:border-text-subtle"
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOn(true)}
        onBlur={() => setOn(false)}
        onClick={(e) => {
          if ((e.nativeEvent as PointerEvent).pointerType === "mouse") return;
          setOn((v) => !v);
        }}
      >
        <JudgePortrait judge={judge} size={256} talking={typing} label={false} />
      </button>
      <p className="label-mono mt-3">
        {j.name}, {copy.landing.meet.playedBy}{" "}
        <a href={j.player.url} target="_blank" rel="noopener" className="text-text-muted underline underline-offset-4 hover:text-text">
          {j.player.name}
        </a>
      </p>

      <h3 className="mt-6 text-[28px] leading-none font-black tracking-[-0.03em]">{j.name}</h3>
      <p className="mt-3 text-[20px] leading-snug font-bold">&ldquo;{j.catchphrase}&rdquo;</p>
      <p className="mt-4 text-[16px] leading-snug text-text-muted">
        <span className="label-mono mr-2 uppercase">{copy.landing.meet.checks}</span>
        {j.checks}
      </p>

      <div className="relative mt-6 rounded-card bg-surface-2 px-4 py-3.5" aria-live="polite">
        <span aria-hidden className="absolute -top-[5px] left-8 size-2.5 rotate-45 bg-surface-2" />
        <p className="label-mono uppercase">{copy.landing.meet.sample}</p>
        <p className="mt-1.5 min-h-[3em] text-[17px] leading-snug font-bold">
          <span className="sr-only">{j.sample}</span>
          <span aria-hidden>
            {words.map((w, i) => (
              <span key={i} className={cn("transition-colors duration-150", i < shown ? "text-text" : "text-text-subtle/40")}>
                {w}{" "}
              </span>
            ))}
          </span>
        </p>
      </div>
    </li>
  );
}

/** The three judges, a card each. */
export function MeetThePanel() {
  return (
    <section aria-labelledby="meet-heading" className="page-x py-20 lg:py-28">
      <h2 id="meet-heading" className="text-[36px] leading-none font-black tracking-[-0.04em] lg:text-act">
        {copy.landing.meet.heading}
      </h2>
      <p className="mt-4 max-w-[560px] text-[18px] leading-snug text-text-muted lg:text-[20px]">{copy.landing.meet.lede}</p>
      <ul className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-6 lg:mt-14 lg:grid-cols-3">
        {ORDER.map((j) => (
          <JudgeCard key={j} judge={j} />
        ))}
      </ul>
    </section>
  );
}
