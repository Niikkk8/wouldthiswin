"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import type { VoiceAnswer } from "./use-voice-answer";

const V = copy.acts.grilling.voice;
/** A press longer than this is push-to-talk: letting go stops. Shorter is a tap: tap again to stop. */
const HOLD_MS = 350;
const BARS = 5;

/** Space bar push-to-talk works whenever focus isn't in a text field (where space types a space). */
const typing = (el: Element | null) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && el.type !== "checkbox") ||
  (el as HTMLElement | null)?.isContentEditable;

/**
 * Answer out loud: tap to start and tap to stop, or hold and let go. Space does the same on a
 * keyboard. While it listens, the words appear in the answer box as they're heard; a live
 * meter (or, without one, a listening animation) shows it's hearing you.
 */
export function VoiceButton({
  voice,
  disabled,
  desktop,
}: {
  voice: VoiceAnswer;
  disabled: boolean;
  desktop: boolean;
}) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const [hold, setHold] = useState(false);
  const [now, setNow] = useState(0);
  const pressedAt = useRef(0);
  const tapToStop = useRef(false);
  const on = voice.state !== "idle";
  const listening = voice.state === "listening";
  const { setMeter } = voice;

  useEffect(() => {
    setMeter((level) =>
      bars.current.forEach((b, i) => {
        if (!b) return;
        // A soft spread across the bars: the middle reacts most.
        const shape = 1 - Math.abs(i - (BARS - 1) / 2) / BARS;
        b.style.transform = `scaleY(${Math.max(0.15, Math.min(1, level * shape * 1.6))})`;
      }),
    );
  }, [setMeter]);

  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [listening]);
  const elapsed = listening ? Math.max(0, Math.floor((now - voice.since) / 1000)) : 0;

  const begin = () => {
    if (!disabled) voice.start();
  };

  // Space: push-to-talk, only when the keyboard isn't busy typing.
  useEffect(() => {
    if (!desktop || disabled) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(document.activeElement)) return;
      e.preventDefault();
      setHold(true);
      begin();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(document.activeElement)) return;
      e.preventDefault();
      setHold(false);
      voice.stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  const label = on ? (hold ? V.holding : V.recording) : desktop ? V.idleDesktop : V.idle;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      aria-label={V.label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        pressedAt.current = Date.now();
        tapToStop.current = on;
        if (on) return;
        setHold(true);
        begin();
      }}
      onPointerUp={() => {
        setHold(false);
        // A second tap stops a tapped run; letting go stops a held one.
        if (tapToStop.current || Date.now() - pressedAt.current >= HOLD_MS) voice.stop();
        tapToStop.current = false;
      }}
      onPointerCancel={() => {
        setHold(false);
        voice.stop();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (on) voice.stop();
        else begin();
      }}
      className={cn(
        "flex h-14 w-full touch-none items-center gap-3 rounded-control border px-4 text-left text-[15px] lg:shrink-0 lg:whitespace-nowrap transition-[color,background-color,border-color,scale] duration-150 ease-out select-none [-webkit-touch-callout:none] active:scale-[0.98] disabled:opacity-60 lg:h-12 lg:w-auto",
        on
          ? "border-loss bg-loss/10 text-text"
          : "border-border-strong text-text-muted hover:text-text",
      )}
    >
      {on ? (
        <Square aria-hidden size={16} strokeWidth={1.75} className="shrink-0 fill-loss text-loss" />
      ) : (
        <Mic aria-hidden size={18} strokeWidth={1.75} className="shrink-0" />
      )}
      <span className="min-w-0 flex-1" aria-live="polite">
        {label}
      </span>
      {listening && (
        <>
          <span aria-hidden className="flex h-5 items-center gap-[3px]">
            {Array.from({ length: BARS }, (_, i) => (
              <span
                key={i}
                ref={(el) => {
                  bars.current[i] = el;
                }}
                style={
                  voice.metered
                    ? { transform: "scaleY(0.15)" }
                    : { transform: "scaleY(0.4)", animationDelay: `${i * 110}ms` }
                }
                className={cn(
                  "h-full w-[3px] origin-center rounded-full bg-loss",
                  !voice.metered && "listen",
                )}
              />
            ))}
          </span>
          <span className="font-mono text-[13px] tabular-nums text-text-muted">
            {fill(V.seconds, { s: elapsed })}
          </span>
        </>
      )}
    </button>
  );
}

/** The mic and its quiet note, or the line that turns it back on after it was refused. */
export function VoiceSlot({
  voice,
  disabled,
  desktop,
}: {
  voice: VoiceAnswer;
  disabled: boolean;
  desktop: boolean;
}) {
  if (voice.enabled)
    return (
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        <VoiceButton voice={voice} disabled={disabled} desktop={desktop} />
        <p className="text-[13px] text-text-subtle">{V.engine}</p>
      </div>
    );
  if (!voice.note) return null;
  return (
    <p className="text-[14px] text-text-subtle">
      {voice.note}{" "}
      <button
        type="button"
        onClick={voice.turnOn}
        className="underline decoration-1 underline-offset-4 hover:text-text"
      >
        {V.turnOn}
      </button>
    </p>
  );
}
