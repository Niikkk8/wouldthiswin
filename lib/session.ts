// The session state machine. Pure functions: the server loads a session, applies one of
// these, and saves the result. The client never runs them; it only mirrors SessionView.

import { copy, fill } from "./copy";
import { displayTree } from "./file-tree";
import type { Iteration } from "./recheck";
import { reviewOf, type Review } from "./review";
import type { Source } from "./sources";
import {
  type ClaimStatus,
  type ClaimWeight,
  type DemoStatus,
  type OddsEvent,
  type Tier,
  BULK_FIRST_COMMIT_DELTA,
  fixDelta,
  SILENCE_SCORE,
  START_ODDS,
  capScanDelta,
  claimDelta,
  demoDelta,
  clampAnswerScore,
  currentOdds,
  makeEvent,
  readyToWin,
  tierFor,
} from "./odds";

export const ACTS = ["scan", "grilling", "deliberation", "verdict", "share"] as const;
export type ActName = (typeof ACTS)[number];

export const JUDGES = ["engineer", "investor", "tired"] as const;
export type Judge = (typeof JUDGES)[number];

export const QUESTION_COUNT = 3;
export const ANSWER_WINDOW_MS = 30_000;
export const ANSWER_GRACE_MS = 3_000;
export const MAX_ANSWER_LENGTH = 300;

export type Claim = {
  /** The claim as the README makes it, e.g. "SMS alerts when your turn is close". */
  claim: string;
  status: ClaimStatus;
  weight: ClaimWeight;
  /** The file that backs it (or partly does). Null when nothing does. */
  file: string | null;
  /** One line of evidence, e.g. "Nothing in the repo backs this". */
  evidence: string;
  /** The odds event label, e.g. "SMS claim unbacked". */
  label: string;
  /** Unbacked claims: what's missing, e.g. "SMS provider". */
  missing: string | null;
  /** Unbacked claims: the files that were read looking for it. */
  searched: string[];
  /** Backed and mocked claims: a line (at most 120 characters) found verbatim in `file`. */
  quote?: string | null;
};

/** What the scan measured in code, beside the claims. */
export type ScanSignals = {
  /** `provided`: the team gave this link on the landing page (it beats auto-detection). */
  demo: { status: DemoStatus; url: string | null; provided?: boolean };
  /** The first commit added more than 70% of today's files. */
  bulkFirstCommit: boolean;
  /** A re-review: what the panel found checking last round's fixes against the diff. */
  iteration?: Iteration;
};

export type Question = {
  judge: Judge;
  text: string;
  /** The phrase the judge caught, shown in red. Must appear in text. */
  caught: string | null;
  /** Epoch ms when the question was first shown. The clock never resets. */
  issuedAt: number | null;
};

export type Answer = {
  text: string;
  receivedAt: number;
  /** Empty or late. Scored as silence without asking the model. */
  silent: boolean;
  late: boolean;
  score: number | null;
  reason: string | null;
};

export type PanelMessage = { judge: Judge; text: string };

export type ReviewStatus = "approved" | "changesRequested" | "commented";

/** A review comment on a file the scan read. The excerpt is verbatim from that file. */
export type ReviewComment = { file: string; excerpt: string; startLine: number; body: string };

export type JudgeReview = { status: ReviewStatus; comment: ReviewComment | null };

export type Panel = {
  chat: PanelMessage[];
  oneLiner: string;
  fixes: string[];
  reviews: Record<Judge, JudgeReview>;
};

export type SessionState = {
  id: string;
  repo: string;
  act: ActName;
  claims: Claim[] | null;
  questions: Question[];
  answers: Answer[];
  events: OddsEvent[];
  panel: Panel | null;
  signals: ScanSignals | null;
  /** Every file path in the repo at scan time (capped). Later acts may only cite these. */
  files: string[];
  /** The files the scan fetched and read (truncated). Review comments may only quote these. */
  sources: Source[];
};

export type SessionError =
  | "wrongAct"
  | "actIncomplete"
  | "alreadyScanned"
  | "badScan"
  | "badQuestion"
  | "notIssued"
  | "alreadyAnswered"
  | "alreadyScored"
  | "needsScore"
  | "alreadyDeliberated";

export type Result = { ok: true; session: SessionState } | { ok: false; error: SessionError };

const ok = (session: SessionState): Result => ({ ok: true, session });
const fail = (error: SessionError): Result => ({ ok: false, error });

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function newSession(id: string, repo: string): SessionState {
  return {
    id,
    repo,
    act: "scan",
    claims: null,
    questions: [],
    answers: [],
    events: [],
    panel: null,
    signals: null,
    files: [],
    sources: [],
  };
}

export type Scan = {
  claims: Claim[];
  questions: Omit<Question, "issuedAt">[];
  signals: ScanSignals;
  files: string[];
  sources: Source[];
  /** The auto-detected demo, kept so a cached scan can be reused with or without a team's own link. */
  autoDemo?: ScanSignals["demo"];
};

/**
 * Stores the scan: one odds event per claim, in order, then one per signal that moves the
 * odds (demo link, bulk first commit). The scan's total is capped (SCAN_CAP_UP / DOWN), so
 * a long README can't farm points. Questions are stored but not shown yet.
 */
export function applyScan(s: SessionState, scan: Scan): Result {
  if (s.act !== "scan") return fail("wrongAct");
  if (s.claims !== null) return fail("alreadyScanned");
  if (scan.questions.length !== QUESTION_COUNT) return fail("badScan");

  const events: OddsEvent[] = [];
  const push = (e: Omit<Parameters<typeof makeEvent>[1], "act">) => {
    const total = currentOdds(events) - START_ODDS;
    events.push(makeEvent(events, { ...e, act: 1, rawDelta: capScanDelta(total, e.rawDelta) }));
  };
  for (const c of scan.claims) {
    push({ kind: "claim", status: c.status, rawDelta: claimDelta(c.status, c.weight), reason: c.label });
  }
  const demo = demoDelta(scan.signals.demo.status);
  if (demo !== 0) {
    const status = scan.signals.demo.status;
    const reason =
      status === "loads" ? copy.odds.demoLoads : status === "video" ? copy.odds.demoVideo : copy.odds.demoDead;
    push({ kind: "demo", rawDelta: demo, reason });
  }
  if (scan.signals.bulkFirstCommit) {
    push({ kind: "commits", rawDelta: BULK_FIRST_COMMIT_DELTA, reason: copy.odds.bulkFirstCommit });
  }
  // A re-review's fix checks come after the scan and outside its cap: acting on the
  // panel's feedback is its own signal, worth at most +12.
  for (const f of scan.signals.iteration?.fixes ?? []) {
    const reason = fill(copy.iteration.event[f.status], { fix: clip(f.fix, 48) });
    events.push(makeEvent(events, { act: 1, kind: "iteration", rawDelta: fixDelta(f.status), reason }));
  }
  return ok({
    ...s,
    claims: scan.claims,
    questions: scan.questions.map((q) => ({ ...q, issuedAt: null })),
    events,
    signals: scan.signals,
    files: scan.files,
    sources: scan.sources,
  });
}

function actComplete(s: SessionState): boolean {
  switch (s.act) {
    case "scan":
      return s.claims !== null;
    case "grilling":
      return s.answers.length === s.questions.length && s.answers.every((a) => a.score !== null);
    case "deliberation":
      return s.panel !== null;
    case "verdict":
      return true;
    case "share":
      return false;
  }
}

/** Moves one act forward. `from` must be the current act, so a stale or replayed call can't skip one. */
export function advance(s: SessionState, from: ActName): Result {
  if (s.act !== from || from === "share") return fail("wrongAct");
  if (!actComplete(s)) return fail("actIncomplete");
  return ok({ ...s, act: ACTS[ACTS.indexOf(from) + 1] });
}

/** Starts the clock on the next question. Showing it again keeps the original start time. */
export function issueQuestion(s: SessionState, index: number, now: number): Result {
  if (s.act !== "grilling") return fail("wrongAct");
  if (index !== s.answers.length || index >= s.questions.length) return fail("badQuestion");
  if (s.questions[index].issuedAt !== null) return ok(s);
  const questions = s.questions.map((q, i) => (i === index ? { ...q, issuedAt: now } : q));
  return ok({ ...s, questions });
}

export function isLate(issuedAt: number, now: number): boolean {
  return now - issuedAt > ANSWER_WINDOW_MS + ANSWER_GRACE_MS;
}

/** Records an answer, once. Late or empty answers are recorded as silence. */
export function acceptAnswer(s: SessionState, index: number, text: string, now: number): Result {
  if (s.act !== "grilling") return fail("wrongAct");
  if (index < 0 || index >= s.questions.length) return fail("badQuestion");
  if (index < s.answers.length) return fail("alreadyAnswered");
  if (index > s.answers.length) return fail("badQuestion");
  const issuedAt = s.questions[index].issuedAt;
  if (issuedAt === null) return fail("notIssued");

  const late = isLate(issuedAt, now);
  const trimmed = text.trim().slice(0, MAX_ANSWER_LENGTH);
  const silent = late || trimmed === "";
  const answer: Answer = {
    text: silent ? "" : trimmed,
    receivedAt: now,
    silent,
    late,
    score: null,
    reason: null,
  };
  return ok({ ...s, answers: [...s.answers, answer] });
}

/** Applies the score. Silent answers get SILENCE_SCORE and ignore `scored`; others need it. */
export function settleAnswer(
  s: SessionState,
  index: number,
  scored: { score: unknown; reason: string } | null,
): Result {
  if (s.act !== "grilling") return fail("wrongAct");
  const answer = s.answers[index];
  if (!answer) return fail("badQuestion");
  if (answer.score !== null) return fail("alreadyScored");
  // Scores land in order, so the replay matches the order the questions were asked.
  if (s.answers.slice(0, index).some((a) => a.score === null)) return fail("badQuestion");

  let score: number;
  let reason: string;
  if (answer.silent) {
    score = SILENCE_SCORE;
    reason = answer.late ? copy.odds.late : copy.odds.silence;
  } else {
    if (!scored) return fail("needsScore");
    score = clampAnswerScore(scored.score);
    reason = scored.reason;
  }

  const event = makeEvent(s.events, { act: 2, kind: "answer", rawDelta: score, reason });
  const answers = s.answers.map((a, i) => (i === index ? { ...a, score, reason } : a));
  return ok({ ...s, answers, events: [...s.events, event] });
}

/** Stores the deliberation, once, during act 3. */
export function applyPanel(s: SessionState, panel: Panel): Result {
  if (s.act !== "deliberation") return fail("wrongAct");
  if (s.panel !== null) return fail("alreadyDeliberated");
  // The file contents were only needed to write the review; comments keep their own excerpts.
  return ok({ ...s, panel, sources: [] });
}

export type Verdict = {
  odds: number;
  tier: Tier;
  readyToWin: boolean;
};

export function verdictOf(s: SessionState): Verdict {
  const odds = currentOdds(s.events);
  return { odds, tier: tierFor(odds), readyToWin: readyToWin(odds, s.claims ?? []) };
}

// What the client sees. Questions stay hidden until they're shown, so nobody reads ahead
// of the clock, and the deliberation and verdict stay hidden until their act.

export type QuestionView = {
  judge: Judge;
  text: string;
  caught: string | null;
  /** Time left on the clock when this view was built. Null once answered. */
  remainingMs: number | null;
  answer: Omit<Answer, "receivedAt"> | null;
};

export type SessionView = {
  id: string;
  repo: string;
  act: ActName;
  odds: number;
  events: OddsEvent[];
  claims: Claim[] | null;
  signals: ScanSignals | null;
  /** The files act 1 draws: cited files, their folders, and the top level. */
  tree: string[];
  questionCount: number;
  questions: QuestionView[];
  panel: Panel | null;
  verdict: Verdict | null;
  /** Act 4 onwards: the code review, built in code from the session. */
  review: Review | null;
};

export function toView(s: SessionState, now: number): SessionView {
  const at = ACTS.indexOf(s.act);
  const questions: QuestionView[] = [];
  for (const [i, q] of s.questions.entries()) {
    if (q.issuedAt === null) break;
    const a = s.answers[i];
    questions.push({
      judge: q.judge,
      text: q.text,
      caught: q.caught,
      remainingMs: a ? null : Math.max(0, q.issuedAt + ANSWER_WINDOW_MS - now),
      answer: a ? { text: a.text, silent: a.silent, late: a.late, score: a.score, reason: a.reason } : null,
    });
  }
  return {
    id: s.id,
    repo: s.repo,
    act: s.act,
    odds: currentOdds(s.events),
    events: s.events,
    claims: s.claims,
    signals: s.signals,
    tree: s.claims ? displayTree(s.files, s.claims) : [],
    questionCount: s.questions.length,
    questions,
    panel: at >= ACTS.indexOf("deliberation") ? s.panel : null,
    verdict: at >= ACTS.indexOf("verdict") ? verdictOf(s) : null,
    review: at >= ACTS.indexOf("verdict") ? reviewOf(s) : null,
  };
}
