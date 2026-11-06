"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";

const INK: Record<string, string> = { black: "#16181b", red: "#d7263d" };

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

/** Cursor that looks like the tip of the marker you're holding. */
const tipCursor = (color: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='11' cy='11' r='5' fill='${color}' stroke='white' stroke-width='2'/></svg>`,
  )}") 11 11, crosshair`;

/**
 * The top of the whiteboard. The markers in its tray are real: pick one up and
 * draw on the board; the eraser wipes it. Esc puts the marker back.
 */
export function HeroBoard({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);

  const ctx = () => canvas.current?.getContext("2d") ?? null;

  const segment = useCallback((c: CanvasRenderingContext2D, s: Stroke, from: number) => {
    const p = s.points;
    c.strokeStyle = s.color;
    c.lineWidth = 6;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.globalAlpha = 0.92;
    c.beginPath();
    if (p.length === 1) {
      c.moveTo(p[0].x, p[0].y);
      c.lineTo(p[0].x + 0.1, p[0].y);
    } else {
      // Smooth through midpoints so fast strokes don't look polygonal.
      const start = Math.max(1, from);
      const m0 = start === 1 ? p[0] : mid(p[start - 2], p[start - 1]);
      c.moveTo(m0.x, m0.y);
      for (let i = start; i < p.length; i++) {
        const m = mid(p[i - 1], p[i]);
        c.quadraticCurveTo(p[i - 1].x, p[i - 1].y, m.x, m.y);
      }
    }
    c.stroke();
  }, []);

  const redraw = useCallback(() => {
    const c = ctx();
    const el = canvas.current;
    if (!c || !el) return;
    c.clearRect(0, 0, el.width, el.height);
    for (const s of strokes.current) segment(c, s, 1);
  }, [segment]);

  // Keep the canvas matched to the board (and the screen's pixel density).
  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = el.clientWidth * dpr;
      cv.height = el.clientHeight * dpr;
      cv.style.width = `${el.clientWidth}px`;
      cv.style.height = `${el.clientHeight}px`;
      ctx()?.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    if (!tool) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTool(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool]);

  const point = (e: React.PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!tool) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = { color: INK[tool], points: [point(e)] };
    strokes.current.push(current.current);
    const c = ctx();
    if (c) segment(c, current.current, 1);
  };

  const onMove = (e: React.PointerEvent) => {
    const s = current.current;
    if (!s) return;
    s.points.push(point(e));
    const c = ctx();
    if (c) segment(c, s, s.points.length - 1);
  };

  const onUp = () => {
    current.current = null;
  };

  const wipe = () => {
    if (!strokes.current.length) return;
    if (reduce) {
      strokes.current = [];
      redraw();
      return;
    }
    setWiping(true);
    setTimeout(() => {
      strokes.current = [];
      redraw();
      setWiping(false);
    }, 320);
  };

  return (
    <div ref={wrap} className="relative">
      {children}

      <canvas
        ref={canvas}
        className={`absolute inset-0 z-30 transition-opacity duration-300 ${tool ? "touch-none" : "pointer-events-none"} ${wiping ? "opacity-0" : "opacity-100"}`}
        style={{ cursor: tool ? tipCursor(INK[tool]) : undefined }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-hidden="true"
      />

      {/* The tray. It sits above the canvas so you can always put the marker down. */}
      <div className="relative z-40 mx-3 mt-14 sm:mx-8 sm:mt-20">
        <p
          className={`absolute bottom-full right-0 mb-6 max-w-xs text-right text-xs text-graphite transition-opacity ${tool ? "opacity-100" : "opacity-0"}`}
          aria-live="polite"
        >
          {tool ? copy.tray.drawing : ""}
        </p>
        <div className="absolute bottom-[calc(100%-6px)] left-[8%] flex items-end gap-2 sm:left-[12%]">
          {copy.tray.markers.map((m) => (
            <motion.button
              key={m.id}
              type="button"
              aria-label={m.label}
              aria-pressed={tool === m.id}
              onClick={() => setTool((t) => (t === m.id ? null : m.id))}
              className="rounded-full focus-visible:outline-offset-4"
              animate={
                tool === m.id ? { y: -16, rotate: -9 } : { y: 0, rotate: m.id === "red" ? -2 : 0 }
              }
              whileHover={tool === m.id ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
            >
              <Marker cap={INK[m.id]} />
            </motion.button>
          ))}
        </div>
        <motion.button
          type="button"
          aria-label={copy.tray.eraser}
          onClick={wipe}
          className="absolute bottom-[calc(100%-4px)] right-[10%] sm:right-[14%]"
          whileHover={{ y: -3 }}
          whileTap={{ x: [0, -6, 6, -4, 0], transition: { duration: 0.3 } }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
        >
          <span className="block h-[17px] w-[78px] rounded-t-[4px] bg-[linear-gradient(180deg,#3a5fd6,#2448b8)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" />
          <span className="block h-[9px] w-[78px] bg-[#55595e] bg-[image:var(--noise)]" />
        </motion.button>

        {/* Ledge: end caps, top face, front lip. */}
        <div className="flex h-[18px] items-stretch drop-shadow-[0_8px_8px_rgb(0_0_0/0.18)]">
          <span className="w-3 rounded-l-[4px] bg-[linear-gradient(180deg,#5d656c,#3b4248)]" />
          <span className="flex-1 bg-[linear-gradient(180deg,#fbfcfc_0%,#d5dadd_35%,#eef1f2_60%,#9aa3a9_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.9),inset_0_-1px_0_rgb(0_0_0/0.25)]" />
          <span className="w-3 rounded-r-[4px] bg-[linear-gradient(180deg,#5d656c,#3b4248)]" />
        </div>
      </div>
    </div>
  );
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function Marker({ cap }: { cap: string }) {
  const id = `barrel-${cap.slice(1)}`;
  return (
    <svg
      viewBox="0 0 140 18"
      className="block h-auto w-[100px] drop-shadow-[0_2px_1px_rgb(0_0_0/0.25)] sm:w-[140px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e9ecee" />
          <stop offset="1" stopColor="#b7bec3" />
        </linearGradient>
      </defs>
      <rect x="0" y="3" width="104" height="13" rx="6.5" fill={`url(#${id})`} />
      <rect x="10" y="6" width="54" height="7" rx="1.5" fill={cap} opacity="0.85" />
      <rect x="98" y="2" width="40" height="15" rx="4" fill={cap} />
      <rect x="102" y="4" width="32" height="2" rx="1" fill="#fff" opacity="0.28" />
    </svg>
  );
}
