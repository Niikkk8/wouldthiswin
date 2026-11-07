"use client";

// Adapted from Magic UI's animated-beam: instead of a gradient looping along a faint path,
// the beam draws itself once (pathLength 0 to 1) and reports when it lands, so the odds
// can move in sync. Geometry is computed by the caller from measured elements.

import { motion } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { EASE } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type BeamState = "hidden" | "drawing" | "drawn";

export function AnimatedBeam({
  d,
  color,
  dashed = false,
  state,
  duration,
  onLanded,
}: {
  /** SVG path data in the container's coordinates. */
  d: string;
  color: string;
  dashed?: boolean;
  state: BeamState;
  /** Seconds. */
  duration: number;
  onLanded?: () => void;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  // Landing is timed off the same duration as the draw. Motion's onAnimationComplete
  // doesn't fire reliably for SVG paths (and never for one inside a mask).
  const landedRef = useRef(onLanded);
  useEffect(() => {
    landedRef.current = onLanded;
  }, [onLanded]);
  useEffect(() => {
    if (state !== "drawing" || !d) return;
    const t = setTimeout(() => landedRef.current?.(), (reduce ? 0.2 : duration) * 1000);
    return () => clearTimeout(t);
  }, [state, d, duration, reduce]);

  if (state === "hidden" || !d) return null;
  const drawing = state === "drawing";

  // Reduced motion: a plain fade instead of the draw.
  if (reduce) {
    return (
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "6 6" : undefined}
        initial={drawing ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
    );
  }

  const draw = (
    <motion.path
      d={d}
      fill="none"
      stroke={dashed ? "#fff" : color}
      strokeWidth={dashed ? 6 : 2}
      strokeLinecap="round"
      initial={drawing ? { pathLength: 0 } : false}
      animate={{ pathLength: 1 }}
      transition={{ duration, ease: EASE }}
    />
  );
  if (!dashed) return draw;

  // pathLength animates through stroke-dasharray, so a dashed beam draws through a mask.
  const mask = `beam-${id.replace(/:/g, "")}`;
  return (
    <g>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse">
          {draw}
        </mask>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeDasharray="6 6"
        mask={`url(#${mask})`}
      />
    </g>
  );
}
