// The acts the dev-only capture routes (/capture/[act]) record, and where each one starts.

import type { DemoAt } from "./fixture";

export const CAPTURE_ACTS = [
  "scan",
  "grilling",
  "deliberation",
  "verdict",
  "fixes",
  "share",
] as const;
export type CaptureAct = (typeof CAPTURE_ACTS)[number];

export const CAPTURE_START: Record<CaptureAct, DemoAt> = {
  scan: "start",
  grilling: "grilling",
  deliberation: "deliberation",
  verdict: "verdict",
  fixes: "verdict",
  share: "share",
};
