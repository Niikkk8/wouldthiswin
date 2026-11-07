// The odds engine. Every number the user sees comes from here, never from the model.
// The model only classifies claims and scores answers; this file turns that into odds.

export const START_ODDS = 50;
export const MIN_ODDS = 1;
export const MAX_ODDS = 99;
export const ANSWER_MIN = -12;
export const ANSWER_MAX = 12;
/** A late or empty answer. Fixed in code; the model never sees it. */
export const SILENCE_SCORE = ANSWER_MIN;

export type ClaimStatus = "backed" | "unbacked" | "unclear";
export type ClaimWeight = "core" | "minor";

// Minor claims move half as much, rounded toward zero (-19 / 2 -> -9). Unclear means
// unverified, not false, so it costs little: -2 core, nothing minor.
const CLAIM_DELTAS: Record<ClaimWeight, Record<ClaimStatus, number>> = {
  core: { backed: 6, unbacked: -19, unclear: -2 },
  minor: { backed: 3, unbacked: -9, unclear: 0 },
};

export function claimDelta(status: ClaimStatus, weight: ClaimWeight): number {
  return CLAIM_DELTAS[weight][status];
}

export type DemoStatus = "loads" | "dead" | "none";

const DEMO_DELTAS: Record<DemoStatus, number> = { loads: 5, dead: -8, none: 0 };

/** A demo link that loads helps; a dead one hurts; no link changes nothing. */
export function demoDelta(status: DemoStatus): number {
  return DEMO_DELTAS[status];
}

/** The first commit added more than 70% of the files. */
export const BULK_FIRST_COMMIT_DELTA = -10;

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

/** The act an event happened in: 1 is the scan, 2 the grilling. */
export type OddsAct = 1 | 2;

export type OddsEvent = {
  act: OddsAct;
  kind: "claim" | "demo" | "commits" | "answer";
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
  e: { act: OddsAct; kind: OddsEvent["kind"]; status?: ClaimStatus; rawDelta: number; reason: string },
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

export function isNotGuilty(claims: readonly { status: ClaimStatus; weight: ClaimWeight }[]) {
  return !claims.some((c) => c.weight === "core" && c.status === "unbacked");
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
