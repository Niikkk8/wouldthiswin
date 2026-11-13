"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import { useRecorder, type RecorderState } from "./use-recorder";

const V = copy.acts.grilling.voice;
/** A press longer than this is push-to-talk: letting go stops. Shorter is a tap: tap again to stop. */
const HOLD_MS = 350;
const BARS = 5;

/** Space bar push-to-talk works whenever focus isn't in a text field (where space types a space). */
const typing = (el: Element | null) =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== "checkbox") || (el as HTMLElement | null)?.isContentEditable;

/**
 * Answer out loud: tap to start and tap to stop, or hold and let go. Space does the same on a
 * keyboard. A live meter shows the mic is hearing you. Recording stops on its own at the buzzer
 * and at 90 seconds. When there's no microphone, `onUnavailable` hands the answer back to typing.
 */
export function VoiceButton({
  disabled,
  uploading,
  stopNow,
  onStart,
  onAudio,
  onUnavailable,
  desktop,
}: {
  disabled: boolean;
  uploading: boolean;
  /** The buzzer went: stop recording now and send what there is. */
  stopNow: boolean;
  onStart: () => void;
  onAudio: (audio: Blob, type: string) => void;
  onUnavailable: (reason: Extract<RecorderState, "denied" | "unsupported">) => void;
  desktop: boolean;
}) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const { state, start, stop } = useRecorder({
    onAudio,
    onLevel: (level) => {
      bars.current.forEach((b, i) => {
        if (!b) return;
        // A soft spread across the bars: the middle reacts most.
        const shape = 1 - Math.abs(i - (BARS - 1) / 2) / BARS;
        b.style.transform = `scaleY(${Math.max(0.15, Math.min(1, level * shape * 1.6))})`;
      });
    },
  });
  const [hold, setHold] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const pressedAt = useRef(0);
  const tapToStop = useRef(false);
  const recording = state === "recording";

  useEffect(() => {
    if (state === "denied" || state === "unsupported") onUnavailable(state);
  }, [state, onUnavailable]);

  useEffect(() => {
    if (stopNow) stop();
  }, [stopNow, stop]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [recording]);
  const elapsed = recording ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  const begin = async () => {
    if (disabled || uploading) return;
    if (!(await start())) return;
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    onStart();
  };

  // Space: push-to-talk, only when the keyboard isn't busy typing.
  useEffect(() => {
    if (!desktop || disabled) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(document.activeElement)) return;
      e.preventDefault();
      setHold(true);
      void begin();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(document.activeElement)) return;
      e.preventDefault();
      setHold(false);
      stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  const label = uploading
    ? V.uploading
    : recording
      ? hold
        ? V.holding
        : V.recording
      : desktop
        ? V.idleDesktop
        : V.idle;

  return (
    <button
      type="button"
      disabled={disabled || uploading || state === "starting"}
      aria-pressed={recording}
      aria-label={V.label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        pressedAt.current = Date.now();
        tapToStop.current = recording;
        if (recording) return;
        setHold(true);
        void begin();
      }}
      onPointerUp={() => {
        setHold(false);
        // A second tap stops a tapped recording; letting go stops a held one.
        if (tapToStop.current || Date.now() - pressedAt.current >= HOLD_MS) stop();
        tapToStop.current = false;
      }}
      onPointerCancel={() => {
        setHold(false);
        stop();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (recording) stop();
        else void begin();
      }}
      className={cn(
        "flex h-14 w-full touch-none items-center gap-3 rounded-control border px-4 text-left text-[15px] transition-colors duration-150 select-none disabled:opacity-60 lg:h-12 lg:w-auto",
        recording ? "border-loss bg-loss/10 text-text" : "border-border-strong text-text-muted hover:text-text",
      )}
    >
      {recording ? (
        <Square aria-hidden size={16} strokeWidth={1.75} className="shrink-0 fill-loss text-loss" />
      ) : (
        <Mic aria-hidden size={18} strokeWidth={1.75} className="shrink-0" />
      )}
      <span className="min-w-0 flex-1" aria-live="polite">
        {label}
      </span>
      {recording && (
        <>
          <span aria-hidden className="flex h-5 items-center gap-[3px]">
            {Array.from({ length: BARS }, (_, i) => (
              <span
                key={i}
                ref={(el) => {
                  bars.current[i] = el;
                }}
                className="h-full w-[3px] origin-center scale-y-[0.15] rounded-full bg-loss"
              />
            ))}
          </span>
          <span className="font-mono text-[13px] tabular-nums text-text-muted">{fill(V.seconds, { s: elapsed })}</span>
        </>
      )}
    </button>
  );
}
