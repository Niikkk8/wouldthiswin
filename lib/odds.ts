// The odds engine. Every number the user sees comes from here, never from the model.
// The model only classifies claims and scores answers; this file turns that into odds.

export const START_ODDS = 50;
export const MIN_ODDS = 1;
export const MAX_ODDS = 99;
const ANSWER_MIN = -12;
export const ANSWER_MAX = 12;
/** A late or empty answer. Fixed in code; the model never sees it. */
export const SILENCE_SCORE = ANSWER_MIN;

/**
 * backed: a file read implements it. mocked: a file read shows it faked (mock data, a
 * hardcoded response, an in-memory stand-in for the service the README names). unbacked:
 * every file it would live in was read in full and it isn't there. unclear: can't tell.
 */
export type ClaimStatus = "backed" | "mocked" | "unbacked" | "unclear";
export type ClaimWeight = "core" | "minor";

// Minor claims move half as much, rounded toward zero (-19 / 2 -> -9). Unclear means
// unverified, not false, so it costs little: -2 core, nothing minor. Mocked sits between:
// judges mark "only works with pre-loaded data" down hard, but it is a working stand-in,
// not an empty promise, and a demo can still run on it.
const CLAIM_DELTAS: Record<ClaimWeight, Record<ClaimStatus, number>> = {
  core: { backed: 6, mocked: -10, unbacked: -19, unclear: -2 },
  minor: { backed: 3, mocked: -5, unbacked: -9, unclear: 0 },
};

export function claimDelta(status: ClaimStatus, weight: ClaimWeight): number {
  return CLAIM_DELTAS[weight][status];
}

/** loads: a live site answers. video: a public video on YouTube, Loom, Vimeo or Drive. */
export type DemoStatus = "loads" | "video" | "dead" | "none";

// Judges call a demo that runs the single largest differentiator, so a live one is the
// biggest single gain the scan can give. A recorded video is the fallback judges accept
// when the wifi dies; a dead link is a broken promise.
const DEMO_DELTAS: Record<DemoStatus, number> = { loads: 8, video: 4, dead: -8, none: 0 };

/** A live demo helps most, a video about half as much; a dead link hurts; no link changes nothing. */
export function demoDelta(status: DemoStatus): number {
  return DEMO_DELTAS[status];
}

/** The grilling's one lifeline (30 more seconds) costs this, whatever the odds. */
export const LIFELINE_DELTA = -2;

/** The first commit added more than 70% of the files. */
export const BULK_FIRST_COMMIT_DELTA = -10;

/**
 * A re-review: the panel checks each fix it asked for last round against the diff since.
 * Addressed +4, partly +2, untouched 0. At most three fixes, so at most +12, outside the
 * scan cap: acting on the judges' feedback is its own signal.
 */
export type FixStatus = "addressed" | "partly" | "untouched";
const FIX_DELTAS: Record<FixStatus, number> = { addressed: 4, partly: 2, untouched: 0 };

export function fixDelta(status: FixStatus): number {
  return FIX_DELTAS[status];
}

/** The scan as a whole (claims, demo, commits) moves the odds by at most +20 / -30. */
export const SCAN_CAP_UP = 20;
export const SCAN_CAP_DOWN = -30;

/** Cuts a scan delta so the scan's running total stays inside the cap. */
export function capScanDelta(totalSoFar: number, rawDelta: number): number {
  return Math.min(SCAN_CAP_UP - totalSoFar, Math.max(SCAN_CAP_DOWN - totalSoFar, rawDelta));
}

/** Model output is untrusted: anything that isn't a number counts as 0. */
export function clampAnswerScore(score: unknown): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.min(ANSWER_MAX, Math.max(ANSWER_MIN, Math.round(score)));
}

export function clampOdds(n: number): number {
  return Math.min(MAX_ODDS, Math.max(MIN_ODDS, Math.round(n)));
}

/** The act an event happened in: 1 the scan (and a re-review's fix checks), 2 the grilling, 3 the rubric. */
export type OddsAct = 1 | 2 | 3;

export type OddsEvent = {
  act: OddsAct;
  kind: "claim" | "demo" | "commits" | "iteration" | "answer" | "lifeline" | "rubric";
  /** Set on claim events, so the replay can color unclear claims. */
  status?: ClaimStatus;
  /** What the odds actually moved, after clamping. */
  delta: number;
  reason: string;
  before: number;
  after: number;
};

export function currentOdds(events: readonly OddsEvent[]): number {
  return events.length ? events[events.length - 1].after : START_ODDS;
}

export function makeEvent(
  events: readonly OddsEvent[],
  e: {
    act: OddsAct;
    kind: OddsEvent["kind"];
    status?: ClaimStatus;
    rawDelta: number;
    reason: string;
  },
): OddsEvent {
  const before = currentOdds(events);
  const after = clampOdds(before + e.rawDelta);
  const event: OddsEvent = {
    act: e.act,
    kind: e.kind,
    delta: after - before,
    reason: e.reason,
    before,
    after,
  };
  if (e.status) event.status = e.status;
  return event;
}

export type Tier = "winner" | "top3" | "honorable" | "participating";

export function tierFor(odds: number): Tier {
  if (odds >= 75) return "winner";
  if (odds >= 55) return "top3";
  if (odds >= 30) return "honorable";
  return "participating";
}

/** The review's status: "Ready to win" needs 55% or more and no core claim missing or mocked. */
export const READY_ODDS = 55;

/** A core claim the code doesn't really deliver: missing, or faked with mock data. */
export function anyCoreMissing(
  claims: readonly { status: ClaimStatus; weight: ClaimWeight }[],
): boolean {
  return claims.some(
    (c) => c.weight === "core" && (c.status === "unbacked" || c.status === "mocked"),
  );
}

export function readyToWin(
  odds: number,
  claims: readonly { status: ClaimStatus; weight: ClaimWeight }[],
): boolean {
  return odds >= READY_ODDS && !anyCoreMissing(claims);
}

export type Tone = "gain" | "loss" | "unclear" | "flat";

export function toneOf(e: Pick<OddsEvent, "delta" | "status">): Tone {
  if (e.status === "unclear") return "unclear";
  if (e.delta > 0) return "gain";
  if (e.delta < 0) return "loss";
  return "flat";
}

/** Drops this big get the red flash and shake. */
export const BIG_DROP = -10;
