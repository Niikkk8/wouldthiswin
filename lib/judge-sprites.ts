// The judges' pixel-art portraits: one horizontal sprite sheet per judge, 128x128 a frame.
// scripts/process-judges.ts builds the sheets from public/judges/<judge>/<frame>.png in the
// frame order below, and JudgePortrait picks frames by index. Keep the two in step.

import type { Judge } from "./session";

export const SPRITE_SIZE = 128;

export const FRAMES = {
  engineer: ["base", "blink", "talk", "reading", "skeptical", "impressed"],
  investor: ["base", "blink", "talk", "calculating", "eyebrow", "impressed"],
  tired: ["base", "blink", "talk", "sip", "unconvinced", "perked", "dozing"],
} as const satisfies Record<Judge, readonly string[]>;

export type Frame<J extends Judge = Judge> = (typeof FRAMES)[J][number];

/** The reactions every judge has, and which frame each judge plays for it. */
export type Reaction = "scan" | "drop" | "gain";
export const REACTION_FRAME: Record<Judge, Record<Reaction, string>> = {
  engineer: { scan: "reading", drop: "skeptical", gain: "impressed" },
  investor: { scan: "calculating", drop: "eyebrow", gain: "impressed" },
  tired: { scan: "sip", drop: "unconvinced", gain: "perked" },
};

/** An odds drop of this much or more gets the doubtful face. */
export const DROP_AT = -10;
/** A gain of this much or more gets the impressed face. */
export const GAIN_AT = 6;

/** The reaction an odds delta earns, if any. */
export function reactionForDelta(delta: number): Exclude<Reaction, "scan"> | null {
  if (delta <= DROP_AT) return "drop";
  if (delta >= GAIN_AT) return "gain";
  return null;
}

export function frameIndex(judge: Judge, frame: string): number {
  const i = (FRAMES[judge] as readonly string[]).indexOf(frame);
  return i < 0 ? 0 : i;
}

export const sheetPath = (judge: Judge) => `/judges/${judge}-sheet.png`;
/** Head avatars draw their 80px crop at half size: one device pixel per art pixel at 2x. */
export const AVATAR_SIZE = 40;
/** The share card's heads, pre-scaled to exactly this, nearest neighbour. */
export const CARD_HEAD = 40;
/** Whole base frames for the share images, pre-scaled the same way. */
export const FACE_SIZES = [128, 256] as const;
export type FaceSize = (typeof FACE_SIZES)[number];

/** The square of each base frame used for head avatars, in sprite pixels. */
export const HEAD_CROP: Record<Judge, { x: number; y: number; size: number }> = {
  engineer: { x: 24, y: 12, size: 80 },
  investor: { x: 24, y: 8, size: 80 },
  tired: { x: 22, y: 8, size: 80 },
};
