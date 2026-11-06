"use client";

import { motion, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import type { Verdict } from "@/lib/judge";
import { HangingBadge } from "./hanging-badge";

type Props = {
  repo: string;
  overall: number;
  verdict: Verdict;
  width: number;
  lanyard: number;
  /** Angle it is released from on load; 0 means it starts at rest. */
  release?: number;
  /** Lean toward the cursor (hero only). */
  follow?: boolean;
  /** Sway a little when the cursor passes over it. */
  nudge?: boolean;
};

const LEAN = 4.5; // max degrees toward the cursor
const SWEEP = 2.5; // max extra degrees from a fast cursor sweep
const GRAB_LIMIT = 30; // max degrees you can pull it by hand
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

/**
 * A badge on a pendulum. You can grab it and throw it; it always swings back
 * and settles. Pivot is the magnet at the top of the lanyard.
 */
export function SwingingBadge({ release = 0, follow = false, nudge = false, ...badge }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Low damping so it overshoots and swings a few times, like a real lanyard.
  const rotate = useSpring(release, { stiffness: 38, damping: 3.2, mass: 1.1 });
  const rest = useRef(0); // where it settles: 0, or the cursor lean
  const drag = useRef<{ x: number; lastX: number; lastT: number; v: number } | null>(null);

  useEffect(() => {
    if (reduce) {
      rotate.jump(0);
      return;
    }
    rotate.set(0);
    if (!follow || !window.matchMedia("(pointer: fine)").matches) return;

    let lastX: number | null = null;
    let settle: ReturnType<typeof setTimeout>;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el || drag.current) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      rest.current = clamp(dx * LEAN * 2, LEAN);
      const v = lastX === null ? 0 : e.clientX - lastX;
      lastX = e.clientX;
      rotate.set(rest.current + clamp(v * 0.06, SWEEP));
      clearTimeout(settle);
      settle = setTimeout(() => rotate.set(rest.current), 120);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearTimeout(settle);
    };
  }, [reduce, follow, rotate]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientX - d.lastX) / dt; // px per ms
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    rotate.jump(clamp((e.clientX - d.x) * 0.14, GRAB_LIMIT));
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (!reduce) {
      // Carry the throw: push past the release point in the direction of travel.
      rotate.jump(clamp(rotate.get() + d.v * 9, GRAB_LIMIT + 6));
    }
    rotate.set(rest.current);
  };

  const onPointerEnter = (e: React.PointerEvent) => {
    if (!nudge || reduce || e.pointerType !== "mouse" || drag.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fromLeft = e.clientX < r.left + r.width / 2;
    rotate.set(fromLeft ? 3.5 : -3.5);
    setTimeout(() => rotate.set(rest.current), 140);
  };

  return (
    <motion.div
      ref={ref}
      style={{ rotate, transformOrigin: "50% 12px", touchAction: "pan-y" }}
      className="cursor-grab select-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={onPointerEnter}
    >
      <HangingBadge {...badge} hook />
    </motion.div>
  );
}
