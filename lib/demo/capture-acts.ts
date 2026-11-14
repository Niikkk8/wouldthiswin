// The acts the dev-only capture routes (/capture/[act]) record, and where each one starts.

import type { DemoAt } from "./fixture";

export const CAPTURE_ACTS = [
  "scan",
  "grilling",
  "deliberation",
  "verdict",
  "fixes",
  "share",
  "rejudge",
  "followup",
] as const;
export type CaptureAct = (typeof CAPTURE_ACTS)[number];

export const CAPTURE_START: Record<CaptureAct, DemoAt> = {
  scan: "start",
  grilling: "grilling",
  deliberation: "deliberation",
  verdict: "verdict",
  fixes: "verdict",
  share: "share",
  // The second round's review, with what changed since the first.
  rejudge: "verdict",
  // A vague answer, and the follow-up the panel asks about it.
  followup: "grilling",
};
