"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { SampleTag } from "@/components/landing/sample-tag";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { useDesktop } from "@/lib/use-desktop";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { StageKind } from "./sample-stage";

// The section's words (heading, lede, captions) render on the server. The acts themselves
// are the heaviest code on the page: they load only when a stage is about to be seen.
const Stage = dynamic(() => import("./sample-stage").then((m) => m.Stage), { ssr: false });

const C = copy.landing.sample.captions;

type Kind = StageKind;

/** The scroll stage on desktop: one caption per step; the grilling spans two of them. */
const STEPS: { kind: Kind; caption: string }[] = [
  { kind: "scan", caption: C[0] },
  { kind: "grilling", caption: C[1] },
  { kind: "grilling", caption: C[2] },
  { kind: "deliberation", caption: C[3] },
  { kind: "review", caption: C[3] },
];
/** Stacked (phones, reduced motion): the same story as blocks. */
const BLOCKS: { kind: Kind; caption: string | null }[] = [
  { kind: "scan", caption: C[0] },
  { kind: "grilling", caption: C[1] },
  { kind: "answered", caption: C[2] },
  { kind: "deliberation", caption: C[3] },
  { kind: "review", caption: null },
];

/** Controls that would do nothing here (next-act buttons, skip) stay hidden. */
const FRAME = "relative [&_[data-demo-hide]]:hidden";

function SampleLabel() {
  return <SampleTag>{copy.landing.sample.label}</SampleTag>;
}

/** Desktop: the stage stays pinned while the page scrolls past it; scroll picks the step. */
function PinnedStage() {
  const reduce = useReducedMotion();
  const outer = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = outer.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), {
      rootMargin: "100% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  const { kind, caption } = STEPS[step];

  return (
    <div ref={outer} style={{ height: `${STEPS.length * 85}svh` }}>
      <div className="sticky top-0 flex h-svh flex-col py-8">
        {/* Two lines high whatever the caption, so the frame below never jumps. */}
        <div className="flex min-h-[76px] items-end justify-between gap-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={caption}
              className="max-w-[760px] text-[30px] leading-tight font-black tracking-[-0.03em] text-balance"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {caption}
            </motion.p>
          </AnimatePresence>
          <div className="flex shrink-0 items-center gap-4">
            <ol className="flex gap-1.5" aria-label="Step">
              {STEPS.map((_, i) => (
                <li
                  key={i}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "h-1 w-6 rounded-full transition-colors",
                    i <= step ? "bg-text" : "bg-border-strong",
                  )}
                />
              ))}
            </ol>
            <SampleLabel />
          </div>
        </div>
        <div className="mt-6 min-h-0 flex-1 overflow-hidden rounded-panel border border-border bg-bg">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={kind}
              className={cn(FRAME, "h-full overflow-hidden px-10 pt-6")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3 }}
            >
              {near && <Stage kind={kind} />}
            </motion.div>
          </AnimatePresence>
          {/* The stage is cut off at the bottom; fade it rather than slice it. */}
          <div
            aria-hidden
            className="pointer-events-none relative -mt-24 h-24 bg-gradient-to-t from-bg to-transparent"
          />
        </div>
      </div>
    </div>
  );
}

/** Phones and reduced motion: each step as its own block. Live ones start once, in view. */
function Block({ kind, caption, still }: { kind: Kind; caption: string | null; still: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const [seen, setSeen] = useState(still);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <li ref={ref}>
      {caption && (
        <p className="text-[24px] leading-tight font-black tracking-[-0.03em] text-balance">
          {caption}
        </p>
      )}
      <div
        className={cn(
          FRAME,
          "mt-4 max-h-[760px] min-h-[320px] overflow-hidden rounded-panel border border-border bg-bg px-4 pt-2 pb-6 sm:px-6",
        )}
      >
        {seen && <Stage kind={kind} still={still} />}
      </div>
    </li>
  );
}

/** "Watch one get judged": the real acts, on the sample session's data, with no requests. */
export function SampleSession() {
  const desktop = useDesktop();
  const reduce = useReducedMotion();
  const pinned = desktop && !reduce;
  return (
    <section aria-labelledby="sample-heading" className="page-x py-20 lg:py-28">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h2
          id="sample-heading"
          className="text-[36px] leading-none font-black tracking-[-0.04em] lg:text-act"
        >
          {copy.landing.sample.heading}
        </h2>
        {!pinned && <SampleLabel />}
      </div>
      <p className="mt-4 max-w-[640px] text-[18px] leading-snug text-text-muted lg:text-[20px]">
        {copy.landing.sample.lede}
      </p>
      {pinned ? (
        <PinnedStage />
      ) : (
        <ol className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-14">
          {BLOCKS.map((b, i) => (
            <Block key={i} kind={b.kind} caption={b.caption} still={reduce} />
          ))}
        </ol>
      )}
      <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
        <Link href="/demo" className={buttonVariants({ variant: "secondary" })}>
          {copy.landing.sample.play}
        </Link>
        <p className="label-mono">{copy.landing.sample.playNote}</p>
      </div>
    </section>
  );
}
