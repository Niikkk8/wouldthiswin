"use client";

import { motion, useAnimate } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Every act is one screen: the header, the act (centred when short, scrolling inside
// itself with a fade when long), and the action bar, always in the same place. The bar's
// chrome belongs to the frame; each act portals in its own button and skip link, so they
// keep the act's state and handlers.

type Slots = { left: HTMLElement | null; right: HTMLElement | null };
const BarSlots = createContext<Slots | null>(null);

/** The act's own scroll area, so the page itself never scrolls. */
export const ActScroll = createContext<React.RefObject<HTMLDivElement | null> | null>(null);
export const useActScroll = () => useContext(ActScroll);

export function ActFrame({
  header,
  step,
  resetKey,
  children,
}: {
  header: React.ReactNode;
  /** "Act 2 of 4", on the left of the bar. */
  step: string;
  /** The act: scrolls back to the top when it changes. */
  resetKey: string;
  children: React.ReactNode;
}) {
  const [slots, setSlots] = useState<Slots>({ left: null, right: null });
  const scroller = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);
  // Stable, so React doesn't detach and reattach them (and set state) on every render.
  const leftRef = useCallback((left: HTMLDivElement | null) => setSlots((s) => (s.left === left ? s : { ...s, left })), []);
  const rightRef = useCallback((right: HTMLDivElement | null) => setSlots((s) => (s.right === right ? s : { ...s, right })), []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [resetKey]);

  // The fade shows only while there's more below.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setFade(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <BarSlots.Provider value={slots}>
      <ActScroll.Provider value={scroller}>
        <div className="flex h-dvh flex-col overflow-hidden">
          {header}
          <div className="relative min-h-0 flex-1">
            <div ref={scroller} data-act-scroll className="h-full overflow-x-hidden overflow-y-auto overscroll-contain">
              <div className="page-x flex min-h-full flex-col">
                <div className="relative my-auto w-full py-6 lg:py-10">{children}</div>
              </div>
            </div>
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent transition-opacity duration-200",
                fade ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
          <div className="shrink-0 border-t border-border bg-bg">
            <div className="page-x flex flex-col gap-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:min-h-[84px] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-4">
              <div className="flex min-w-0 items-center justify-between gap-6 sm:justify-start">
                <p className="label-mono shrink-0 uppercase" data-act-step>
                  {step}
                </p>
                <div ref={leftRef} className="min-w-0" />
              </div>
              <div ref={rightRef} data-action className="sm:shrink-0" />
            </div>
          </div>
        </div>
      </ActScroll.Provider>
    </BarSlots.Provider>
  );
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || !!t.closest("input, textarea, select, button, a, [role=button]"));

/**
 * The act's one way forward, in the bar. Until `ready` the button is disabled and says what
 * is happening; when it's ready it enables with one pulse, and Enter presses it. Outside an
 * ActFrame (the landing page's sample) it renders nothing.
 */
export function ActionBar({
  label,
  status,
  ready,
  pending = false,
  onNext,
  skip,
  href,
}: {
  label: string;
  /** What's happening while it isn't ready. */
  status?: string;
  ready: boolean;
  /** The step is being sent. */
  pending?: boolean;
  onNext?: () => void;
  /** Plain text on the left that never competes with the button. */
  skip?: { label: string; onClick: () => void } | null;
  /** A link instead of an action (the sample session's way out). */
  href?: string;
}) {
  const slots = useContext(BarSlots);
  const reduce = useReducedMotion();
  const enabled = ready && !pending;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const was = useRef(ready);
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  });

  // One subtle pulse when it becomes ready, never on arrival already ready.
  useEffect(() => {
    if (ready && !was.current && !reduce && scope.current) {
      animate(scope.current, { scale: [1, 1.045, 1] }, { duration: 0.5, ease: "easeOut" });
    }
    was.current = ready;
  }, [ready, reduce, animate, scope]);

  useEffect(() => {
    if (!enabled || href) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (typing(e.target)) return;
      e.preventDefault();
      onNextRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, href]);

  if (!slots) return null;
  const text = ready ? label : (status ?? label);
  return (
    <>
      {slots.left &&
        skip &&
        createPortal(
          <button type="button" onClick={skip.onClick} className="label-mono underline underline-offset-4 hover:text-text">
            {skip.label}
          </button>,
          slots.left,
        )}
      {slots.right &&
        createPortal(
          <motion.div ref={scope} className="origin-center">
            {href ? (
              <Button asChild className="w-full sm:w-auto sm:min-w-[240px]">
                <a href={href}>{label}</a>
              </Button>
            ) : (
              <Button
                onClick={() => onNext?.()}
                disabled={!enabled}
                aria-live="polite"
                data-ready={ready || undefined}
                className="w-full sm:w-auto sm:min-w-[240px]"
              >
                {text}
              </Button>
            )}
          </motion.div>,
          slots.right,
        )}
    </>
  );
}
