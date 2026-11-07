"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "cn";
import { JudgePortrait } from "@/components/judge-portrait";
import { copy } from "@/lib/copy";
import type { Reaction } from "@/lib/judge-sprites";
import { EASE } from "@/lib/motion";
import type { Judge } from "@/lib/session";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const ORDER: readonly Judge[] = ["engineer", "investor", "tired"];
/** What each judge does when you point at them. */
const POSE: Record<Judge, Exclude<Reaction, "scan">> = { engineer: "drop", investor: "drop", tired: "gain" };
/** Bubbles hug the row's edges so they never leave a phone screen. */
const ALIGN: Record<Judge, string> = {
  engineer: "left-0",
  investor: "left-1/2 -translate-x-1/2",
  tired: "right-0",
};
const TAIL: Record<Judge, string> = { engineer: "left-12", investor: "left-1/2 -translate-x-1/2", tired: "right-12" };

/**
 * The panel in the hero. Hover (or tap) a judge: the Engineer goes skeptical, the Investor
 * raises an eyebrow, the Tired Judge perks up, and each says their line.
 */
export function HeroJudges({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<Judge | null>(null);
  return (
    <ul className={cn("flex gap-2 pt-16 sm:gap-4", className)}>
      {ORDER.map((j) => {
        const on = active === j;
        return (
          <li key={j} className="relative min-w-0">
            <AnimatePresence>
              {on && (
                <motion.p
                  key="bubble"
                  role="status"
                  className={cn(
                    "absolute bottom-[calc(100%+12px)] z-10 rounded-card border border-border-strong bg-surface-2 px-3.5 py-2 text-[15px] leading-tight font-bold whitespace-nowrap",
                    ALIGN[j],
                  )}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: reduce ? 0.15 : 0.2, ease: EASE }}
                >
                  &ldquo;{copy.judges[j].catchphrase}&rdquo;
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-full -mt-[5px] size-2.5 rotate-45 border-r border-b border-border-strong bg-surface-2",
                      TAIL[j],
                    )}
                  />
                </motion.p>
              )}
            </AnimatePresence>
            <button
              type="button"
              aria-pressed={on}
              aria-label={`${copy.judges[j].name}: ${copy.judges[j].catchphrase}`}
              className="block w-[100px] overflow-hidden rounded-card border border-border transition-colors hover:border-border-strong aria-pressed:border-text-subtle sm:w-auto"
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(j)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setActive((a) => (a === j ? null : a))}
              // Keyboard focus shows it; a tap toggles it; a mouse already has it from hovering.
              onFocus={(e) => e.currentTarget.matches(":focus-visible") && setActive(j)}
              onBlur={() => setActive((a) => (a === j ? null : a))}
              onClick={(e) => {
                if ((e.nativeEvent as PointerEvent).pointerType === "mouse") return;
                setActive((a) => (a === j ? null : j));
              }}
            >
              <JudgePortrait judge={j} label={false} pose={on ? POSE[j] : null} className="-mx-[15px] sm:mx-0" />
            </button>
            <p className="label-mono mt-2 truncate">{copy.judges[j].name}</p>
          </li>
        );
      })}
    </ul>
  );
}
