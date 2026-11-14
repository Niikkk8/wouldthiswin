"use client";

import { motion } from "motion/react";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const URGENT_S = 10;

export const clockText = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The answer clock. While the question is being read it shows the full window, still; then it
 * counts down. The bar runs on its own linear animation from where the clock is to zero, and
 * restarts when the lifeline adds time (`windowMs` changes).
 */
export function Timer({
  left,
  readLeft,
  windowMs,
  stopped,
}: {
  left: number;
  readLeft: number;
  windowMs: number;
  stopped: boolean;
}) {
  const reduce = useReducedMotion();
  const reading = readLeft > 0 && !stopped;
  const secs = Math.ceil(left / 1000);
  const urgent = !reading && secs <= URGENT_S;
  const pulse = urgent && !stopped && !reduce && secs > 0;

  return (
    <div className="w-full lg:w-[212px]">
      <motion.p
        key={pulse ? secs : "steady"}
        aria-hidden
        className={cn(
          "origin-right text-right font-mono text-[56px] leading-none tabular-nums transition-colors duration-200 lg:text-[88px]",
          urgent ? "text-loss" : reading ? "text-text-muted" : "text-text",
        )}
        initial={pulse ? { scale: 1.08, opacity: 0.7 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {clockText(left)}
      </motion.p>
      <div className="mt-3 h-[3px] w-full overflow-hidden bg-border-strong">
        <motion.div
          key={`${windowMs}-${reading}`}
          className={cn("h-full origin-left", urgent ? "bg-loss" : "bg-text")}
          initial={{ scaleX: left / windowMs }}
          animate={{ scaleX: stopped || reading ? left / windowMs : 0 }}
          transition={
            stopped || reading ? { duration: 0 } : { duration: left / 1000, ease: "linear" }
          }
        />
      </div>
      <p className="label-mono mt-2 text-right tabular-nums" aria-live="polite">
        {reading ? fill(copy.acts.grilling.read, { n: Math.ceil(readLeft / 1000) }) : ""}
      </p>
      <p className="sr-only" aria-live="assertive">
        {urgent && !stopped && secs > 0 ? copy.acts.grilling.tenSeconds : ""}
      </p>
    </div>
  );
}
