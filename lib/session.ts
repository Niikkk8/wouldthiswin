// The session state machine. Pure functions: the server loads a session, applies one of
// these, and saves the result. The client never runs them; it only mirrors SessionView.

import { copy } from "./copy";
import {
  type ClaimStatus,
  type ClaimWeight,
  type OddsEvent,
  type Tier,
  SILENCE_SCORE,
  claimDelta,
  clampAnswerScore,
  currentOdds,
  isNotGuilty,
  makeEvent,
  tierFor,
} from "./odds";

export const ACTS = ["scan", "grilling", "deliberation", "verdict", "share"] as const;
export type ActName = (typeof ACTS)[number];

export const JUDGES = ["engineer", "investor", "tired"] as const;
export type Judge = (typeof JUDGES)[number];

export const QUESTION_COUNT = 3;
export const ANSWER_WINDOW_MS = 30_000;
export const ANSWER_GRACE_MS = 3_000;
export const MAX_ANSWER_LENGTH = 400;

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

export type Panel = {
  chat: PanelMessage[];
  oneLiner: string;
  fixes: string[];
  /** Used only when a core claim is unbacked, e.g. "of overpromising". */
  charge: string;
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

export function newSession(id: string, repo: string): SessionState {
  return { id, repo, act: "scan", claims: null, questions: [], answers: [], events: [], panel: null };
}

/** Stores the scan: one odds event per claim, in order, and the three questions (not yet shown). */
export function applyScan(
  s: SessionState,
  scan: { claims: Claim[]; questions: Omit<Question, "issuedAt">[] },
): Result {
  if (s.act !== "scan") return fail("wrongAct");
  if (s.claims !== null) return fail("alreadyScanned");
  if (scan.questions.length !== QUESTION_COUNT) return fail("badScan");

  const events: OddsEvent[] = [];
  for (const c of scan.claims) {
    events.push(
      makeEvent(events, {
        act: 1,
        kind: "claim",
        status: c.status,
        rawDelta: claimDelta(c.status, c.weight),
        reason: c.label,
      }),
    );
  }
  return ok({
    ...s,
    claims: scan.claims,
    questions: scan.questions.map((q) => ({ ...q, issuedAt: null })),
    events,
  });
}

function actComplete(s: SessionState): boolean {
  switch (s.act) {
    case "scan":
      return s.claims !== null;
    case "grilling":
      return (
        s.answers.length === s.questions.length &&
        s.answers.every((a) => a.score !== null) &&
        s.panel !== null
      );
    case "deliberation":
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

/** Stores the deliberation, once every answer is scored. */
export function applyPanel(s: SessionState, panel: Panel): Result {
  if (s.act !== "grilling") return fail("wrongAct");
  if (s.panel !== null) return fail("alreadyDeliberated");
  const done =
    s.answers.length === s.questions.length && s.answers.every((a) => a.score !== null);
  if (!done) return fail("actIncomplete");
  return ok({ ...s, panel });
}

export type Verdict = {
  odds: number;
  tier: Tier;
  /** Null means not guilty. */
  charge: string | null;
};

export function verdictOf(s: SessionState): Verdict {
  const odds = currentOdds(s.events);
  const guilty = !isNotGuilty(s.claims ?? []);
  return { odds, tier: tierFor(odds), charge: guilty ? (s.panel?.charge ?? null) : null };
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
  questionCount: number;
  questions: QuestionView[];
  panel: Panel | null;
  verdict: Verdict | null;
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
    questionCount: s.questions.length,
    questions,
    panel: at >= ACTS.indexOf("deliberation") ? s.panel : null,
    verdict: at >= ACTS.indexOf("verdict") ? verdictOf(s) : null,
  };
}
