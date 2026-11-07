"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { copy } from "@/lib/copy";
import {
  FRAMES,
  SPRITE_SIZE,
  REACTION_FRAME,
  HEAD_CROP,
  frameIndex,
  sheetPath,
  type Reaction,
} from "@/lib/judge-sprites";
import type { Judge } from "@/lib/session";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const BLINK_MS = 120;
const BLINK_MIN_MS = 3000;
const BLINK_MAX_MS = 6000;
const TALK_MS = 140;
export const REACTION_HOLD_MS = 1800;

/** A reaction to play once. A new `key` plays it again. */
export type ReactionCue = { kind: Reaction; key: string | number };

/** Whole multiples of the 128px sprite, so every art pixel is the same size. */
export type PortraitSize = 128 | 256 | 384;

/**
 * One judge, drawn from their sprite sheet. Swapping frames moves the background, so the
 * image never reloads or flickers.
 *
 * What shows, highest first: a reaction (held 1.8s), dozing (the Tired Judge only), talking
 * (base and talk every 140ms), the resting frame (`rest="scan"` holds the scan face), and
 * otherwise base with a 120ms blink every 3 to 6 seconds. Reduced motion: base, always.
 */
export function JudgePortrait({
  judge,
  size = 128,
  talking = false,
  rest = "idle",
  reaction = null,
  dozing = false,
  label = true,
  className,
}: {
  judge: Judge;
  size?: PortraitSize;
  talking?: boolean;
  rest?: "idle" | "scan";
  reaction?: ReactionCue | null;
  /** Shown only for the Tired Judge. */
  dozing?: boolean;
  /** False when the judge's name is already next to the portrait. */
  label?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const blink = useBlink(!reduce && !talking && rest === "idle");
  const mouthOpen = useToggle(!reduce && talking, TALK_MS);
  const held = useHeld(reaction);

  let frame = "base";
  if (reduce) frame = "base";
  else if (held) frame = REACTION_FRAME[judge][held];
  else if (dozing && judge === "tired") frame = "dozing";
  else if (talking) frame = mouthOpen ? "talk" : "base";
  else if (rest === "scan") frame = REACTION_FRAME[judge].scan;
  else if (blink) frame = "blink";

  const count = FRAMES[judge].length;
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label ? copy.judges[judge].name : undefined}
      aria-hidden={label ? undefined : true}
      data-frame={frame}
      className={cn("shrink-0 bg-no-repeat", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sheetPath(judge)})`,
        backgroundSize: `${count * size}px ${size}px`,
        backgroundPosition: `${-frameIndex(judge, frame) * size}px 0`,
        imageRendering: "pixelated",
      }}
    />
  );
}

/** A small head: the base frame of the sprite sheet, cropped to the face. */
export function JudgeHead({ judge, size = 32, className }: { judge: Judge; size?: number; className?: string }) {
  const crop = HEAD_CROP[judge];
  const scale = size / crop.size;
  return (
    <span
      aria-hidden
      className={cn("block shrink-0 rounded-full bg-bg bg-no-repeat", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sheetPath(judge)})`,
        backgroundSize: `${FRAMES[judge].length * SPRITE_SIZE * scale}px ${SPRITE_SIZE * scale}px`,
        backgroundPosition: `${-crop.x * scale}px ${-crop.y * scale}px`,
        // Pixelated when it scales up by a whole number; smoothed when it shrinks.
        imageRendering: Number.isInteger(scale) ? "pixelated" : "auto",
      }}
    />
  );
}

/** True for 120ms every 3 to 6 seconds, at random. */
function useBlink(on: boolean): boolean {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!on) return;
    let t: ReturnType<typeof setTimeout>;
    const wait = () => {
      t = setTimeout(
        () => {
          setBlink(true);
          t = setTimeout(() => {
            setBlink(false);
            wait();
          }, BLINK_MS);
        },
        BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS),
      );
    };
    wait();
    return () => {
      clearTimeout(t);
      setBlink(false);
    };
  }, [on]);
  return on && blink;
}

/** Flips every `ms` while on. */
function useToggle(on: boolean, ms: number): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setV((x) => !x), ms);
    return () => {
      clearInterval(t);
      setV(false);
    };
  }, [on, ms]);
  return on && v;
}

/** The cue's reaction for 1.8 seconds after it arrives, then null. */
function useHeld(cue: ReactionCue | null): Reaction | null {
  const [done, setDone] = useState<string | number | null>(null);
  const key = cue?.key ?? null;
  useEffect(() => {
    if (key === null) return;
    const t = setTimeout(() => setDone(key), REACTION_HOLD_MS);
    return () => clearTimeout(t);
  }, [key]);
  return cue && cue.key !== done ? cue.kind : null;
}

/**
 * The three judges side by side. On a phone each sits in a narrower window that trims the
 * shoulders, so the row fits without scaling the art.
 */
export function JudgeRow({
  judges = ["engineer", "investor", "tired"],
  rest = "idle",
  reactions,
  dozing = false,
  names = false,
  className,
}: {
  judges?: readonly Judge[];
  rest?: "idle" | "scan";
  reactions?: Partial<Record<Judge, ReactionCue | null>>;
  dozing?: boolean;
  names?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("flex gap-2 sm:gap-4", className)}>
      {judges.map((j) => (
        <li key={j} className="min-w-0">
          <div className="w-[100px] overflow-hidden rounded-card border border-border sm:w-auto">
            <JudgePortrait
              judge={j}
              rest={rest}
              reaction={reactions?.[j] ?? null}
              dozing={dozing}
              label={!names}
              className="-mx-[15px] sm:mx-0"
            />
          </div>
          {names && <p className="label-mono mt-2 truncate">{copy.judges[j].name}</p>}
        </li>
      ))}
    </ul>
  );
}
