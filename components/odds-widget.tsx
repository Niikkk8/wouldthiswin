"use client";

import NumberFlow from "@number-flow/react";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import { EASE, EASE_CSS } from "@/lib/motion";
import { BIG_DROP, currentOdds, toneOf, type OddsEvent, type Tone } from "@/lib/odds";

const CHIP: Record<Tone, string> = {
  gain: "bg-gain text-bg",
  loss: "bg-loss text-bg",
  unclear: "bg-unclear text-bg",
  flat: "bg-surface-2 text-text-muted",
};

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function announcement(e: OddsEvent): string {
  const direction = e.delta > 0 ? copy.odds.up : e.delta < 0 ? copy.odds.down : copy.odds.unchanged;
  return fill(copy.odds.announce, {
    odds: e.after,
    direction,
    amount: Math.abs(e.delta),
    reason: e.reason,
  });
}

/**
 * The live odds. Same place and size on acts 1 to 3: top right on desktop, a sticky bar
 * on mobile. `events` is what has been revealed so far, so the scan can play them in.
 */
export function OddsWidget({ events }: { events: readonly OddsEvent[] }) {
  const reduce = useReducedMotion();
  const odds = currentOdds(events);
  const last = events.at(-1);
  const count = events.length;

  // The chip and the struck-through previous value are fresh for 2s after each event.
  // Both start settled, so a reload doesn't replay or re-announce the last event.
  const [settledAt, setSettledAt] = useState(count);
  const [flashDoneAt, setFlashDoneAt] = useState(count);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const fresh = settledAt !== count;
  const bigDrop = !!last && last.delta <= BIG_DROP && !reduce;
  const flashing = bigDrop && flashDoneAt !== count;

  useEffect(() => {
    const t = setTimeout(() => setSettledAt(count), 2000);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (!flashing) return;
    animate(scope.current, { x: [0, -6, 6, -6, 0] }, { duration: 0.36, ease: "easeInOut" });
    const t = setTimeout(() => setFlashDoneAt(count), 600);
    return () => clearTimeout(t);
  }, [flashing, count, animate, scope]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.25, ease: EASE }}
      className={cn(
        "sticky top-0 z-30 -mx-5 flex items-center gap-3 border-b border-border bg-bg px-5 py-3",
        "lg:absolute lg:top-0 lg:right-24 lg:mx-0 lg:block lg:border-0 lg:bg-transparent lg:p-0 lg:text-right",
      )}
    >
      <p aria-hidden className="label-mono hidden uppercase lg:mb-1.5 lg:block">
        {copy.odds.label}
      </p>
      <div className="flex items-baseline gap-3 lg:justify-end">
        {last && (
          <motion.s
            aria-hidden
            className="hidden font-mono text-[17px] text-text-subtle lg:inline"
            animate={{ opacity: fresh ? 1 : 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {last.before}%
          </motion.s>
        )}
        <div ref={scope}>
          <NumberFlow
            value={odds}
            suffix="%"
            aria-hidden
            // Default mask padding adds 0.5em of height; this keeps the widget compact.
            style={{ "--number-flow-mask-height": "0.1em" } as React.CSSProperties}
            className={cn(
              "text-[36px] leading-[0.9] font-black tracking-[-0.05em] transition-colors duration-200 lg:text-odds",
              flashing ? "text-loss" : "text-text",
            )}
            transformTiming={{ duration: 600, easing: EASE_CSS }}
            spinTiming={{ duration: 600, easing: EASE_CSS }}
            opacityTiming={{ duration: 300, easing: "ease-out" }}
          />
        </div>
      </div>
      {last && (
        <motion.p
          key={count}
          className={cn(
            "inline-flex max-w-full items-center gap-2 truncate rounded-[6px] px-2.5 py-1 font-mono text-[13px] lg:mt-2",
            CHIP[toneOf(last)],
          )}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: fresh ? 1 : 0.55, scale: 1 }}
          transition={{ duration: reduce ? 0.2 : fresh ? 0.2 : 0.6, ease: EASE }}
        >
          <span>{signed(last.delta)}</span>
          <span className="truncate">{last.reason}</span>
        </motion.p>
      )}
      <p className="sr-only" aria-live="polite">
        {last && fresh ? announcement(last) : ""}
      </p>
      <p className="sr-only">{fill(copy.odds.current, { odds })}</p>
    </motion.div>
  );
}
