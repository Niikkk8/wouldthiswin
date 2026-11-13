// The session state machine. Pure functions: the server loads a session, applies one of
// these, and saves the result. The client never runs them; it only mirrors SessionView.

import { copy, fill } from "./copy";
import {
  acceptsLifeline,
  acceptsRecordingStart,
  acceptsSpoken,
  acceptsUpload,
  clockView,
  type ClockSettings,
  type QuestionKind,
} from "./deadline";
import { displayTree } from "./file-tree";
import type { ClaimCategory } from "./evidence/extract";
import type { SourceKind } from "./evidence/sources";
import type { Iteration } from "./recheck";
import { reviewOf, type Review } from "./review";
import { rubricFor } from "./events";
import { aggregate, rubricDelta, type Rubric, type ScoredCriterion } from "./rubric";
import type { Source } from "./sources";
import {
  type ClaimStatus,
  type ClaimWeight,
  type DemoStatus,
  type OddsEvent,
  type Tier,
  BULK_FIRST_COMMIT_DELTA,
  LIFELINE_DELTA,
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
/** Long enough for 90 seconds of speech, transcribed. */
export const MAX_ANSWER_LENGTH = 1000;

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
  /** The line `quote` is on, at the scanned commit. */
  line?: number | null;
  /** The verification agent's verdict (lib/evidence/verify.ts). Older rows have none. */
  verdict?: "supported" | "partial" | "unsupported" | "cant_verify";
  category?: ClaimCategory;
  /** Where the claim was made, and the words that made it. */
  source?: SourceKind;
  span?: string;
  /** Lines at the scanned commit that show it, as the agent read them. */
  citations?: { path: string; start: number; end: number }[];
};

/** What the scan measured in code, beside the claims. */
export type ScanSignals = {
  /** `provided`: the team gave this link on the landing page (it beats auto-detection). */
  demo: { status: DemoStatus; url: string | null; provided?: boolean };
  /** The first commit added more than 70% of today's files. */
  bulkFirstCommit: boolean;
  /** A re-review: what the panel found checking last round's fixes against the diff. */
  iteration?: Iteration;
  /** The commit the scan read. Evidence links point at files at exactly this commit. */
  commit?: string;
};

export type Question = {
  judge: Judge;
  text: string;
  /** The phrase the judge caught, shown in red. Must appear in text. */
  caught: string | null;
  /** Sets the answer window (lib/deadline.ts). Rows from before kinds existed default by judge. */
  kind?: QuestionKind;
  /** Epoch ms when the question was first shown. The clock never resets. */
  issuedAt: number | null;
  /** The session's one lifeline was pulled on this question: 30 more seconds. */
  lifeline?: boolean;
  /** Server time a voice recording started, if one did. Uploads are judged against it. */
  recordingStartedAt?: number | null;
};

/** The window a question gets when the scan didn't say: the one-sentence question is a quick fact. */
const DEFAULT_KIND: Record<Judge, QuestionKind> = { tired: "fact", investor: "decision", engineer: "tradeoff" };

export const kindOf = (q: Pick<Question, "kind" | "judge">): QuestionKind => q.kind ?? DEFAULT_KIND[q.judge];

/** Per-person settings, copied onto the session when it starts. Never shown on public surfaces. */
export type SessionSettings = ClockSettings;
export const DEFAULT_SETTINGS: SessionSettings = { extendedTime: false };

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
  /** The rubric, scored. Panels written before rubrics existed have none. */
  criteria?: ScoredCriterion[];
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
  settings: SessionSettings;
  /** Opt-ins, both off by default: a public /v link, and a place on the public board. */
  visibility: Visibility;
  /** The event this session was judged for (lib/events): its rubric and judge context. */
  eventSlug: string | null;
};

export type Visibility = { shareable: boolean; listed: boolean };
export const PRIVATE: Visibility = { shareable: false, listed: false };

/** Listing needs a shareable verdict; turning sharing off takes it off the board too. */
export function nextVisibility(current: Visibility, change: Partial<Visibility>): Visibility {
  const shareable = change.shareable ?? current.shareable;
  const listed = shareable ? (change.listed ?? current.listed) : false;
  return { shareable, listed: listed && shareable };
}

export type SessionError =
  | "wrongAct"
  | "actIncomplete"
  | "alreadyScanned"
  | "badScan"
  | "badQuestion"
  | "notIssued"
  | "lifelineUsed"
  | "tooLate"
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
    settings: DEFAULT_SETTINGS,
    visibility: PRIVATE,
    eventSlug: null,
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

type OpenQuestion = Question & { issuedAt: number };

/** The question on the clock: issued, not yet answered. */
function openQuestion(s: SessionState, index: number): { ok: true; q: OpenQuestion } | { ok: false; error: SessionError } {
  if (s.act !== "grilling") return { ok: false, error: "wrongAct" };
  if (index < 0 || index >= s.questions.length) return { ok: false, error: "badQuestion" };
  if (index < s.answers.length) return { ok: false, error: "alreadyAnswered" };
  if (index > s.answers.length) return { ok: false, error: "badQuestion" };
  const q = s.questions[index];
  if (q.issuedAt === null) return { ok: false, error: "notIssued" };
  return { ok: true, q: { ...q, issuedAt: q.issuedAt } };
}

const clockOf = (q: OpenQuestion) => ({ ...q, kind: kindOf(q) });

/** Late by the server's clock (lib/deadline.ts), with the voice grace when a recording started in time. */
function isLate(s: SessionState, q: OpenQuestion, now: number): boolean {
  return !acceptsSpoken(clockOf(q), s.settings, q.recordingStartedAt ?? null, now);
}

/** Marks when a voice recording started, once, if the clock is still running. */
export function startRecording(s: SessionState, index: number, now: number): Result {
  const open = openQuestion(s, index);
  if (!open.ok) return fail(open.error);
  if (open.q.recordingStartedAt != null) return ok(s);
  if (!acceptsRecordingStart(clockOf(open.q), s.settings, now)) return fail("tooLate");
  const questions = s.questions.map((q, i) => (i === index ? { ...q, recordingStartedAt: now } : q));
  return ok({ ...s, questions });
}

/** Whether a recording's audio may be transcribed now. Null when it may; the reason otherwise. */
export function uploadRefusal(s: SessionState, index: number, now: number): SessionError | null {
  const open = openQuestion(s, index);
  if (!open.ok) return open.error;
  return acceptsUpload(clockOf(open.q), s.settings, open.q.recordingStartedAt ?? null, now) ? null : "tooLate";
}

export const lifelineUsed = (s: Pick<SessionState, "questions">) => s.questions.some((q) => q.lifeline);

/**
 * The one lifeline: 30 more seconds on the open question, for a fixed cost in the odds. The
 * cost is the same whatever the odds, and it lands at once, before the answer is scored.
 */
export function pullLifeline(s: SessionState, index: number, now: number): Result {
  const open = openQuestion(s, index);
  if (!open.ok) return fail(open.error);
  if (lifelineUsed(s)) return fail("lifelineUsed");
  if (!acceptsLifeline(clockOf(open.q), s.settings, now)) return fail("tooLate");
  const questions = s.questions.map((q, i) => (i === index ? { ...q, lifeline: true } : q));
  const event = makeEvent(s.events, { act: 2, kind: "lifeline", rawDelta: LIFELINE_DELTA, reason: copy.odds.lifeline });
  return ok({ ...s, questions, events: [...s.events, event] });
}

/** Records an answer, once. Late or empty answers are recorded as silence. */
export function acceptAnswer(s: SessionState, index: number, text: string, now: number): Result {
  const open = openQuestion(s, index);
  if (!open.ok) return fail(open.error);

  const late = isLate(s, open.q, now);
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

/**
 * Stores the deliberation, once, during act 3, and with it the rubric's one odds event
 * (lib/rubric.ts rubricDelta): the weighted score, mapped into a bounded move.
 */
export function applyPanel(s: SessionState, panel: Panel, rubric: Rubric = rubricFor(s.eventSlug)): Result {
  if (s.act !== "deliberation") return fail("wrongAct");
  if (s.panel !== null) return fail("alreadyDeliberated");
  const events = [...s.events];
  if (panel.criteria?.length) {
    const agg = aggregate(panel.criteria, rubric);
    events.push(makeEvent(events, { act: 3, kind: "rubric", rawDelta: rubricDelta(agg), reason: fill(copy.odds.rubric, { score: agg }) }));
  }
  // The file contents were only needed to write the review; comments keep their own excerpts.
  return ok({ ...s, panel, events, sources: [] });
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
  kind: QuestionKind;
  /** Read grace left before the clock starts, when this view was built. Null once answered. */
  readMs: number | null;
  /** Time left on the clock when this view was built, read grace excluded. Null once answered. */
  remainingMs: number | null;
  /** The whole window, lifeline included, for the progress bar. */
  windowMs: number;
  lifeline: boolean;
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
  /** The owner's own settings and lifeline. The public review never carries these. */
  settings: SessionSettings;
  lifelineAvailable: boolean;
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
    const clock = clockView(clockOf({ ...q, issuedAt: q.issuedAt }), s.settings, now);
    questions.push({
      judge: q.judge,
      text: q.text,
      caught: q.caught,
      kind: kindOf(q),
      readMs: a ? null : clock.readMs,
      remainingMs: a ? null : clock.remainingMs,
      windowMs: clock.windowMs,
      lifeline: q.lifeline === true,
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
    settings: s.settings,
    lifelineAvailable: s.act === "grilling" && !lifelineUsed(s),
    panel: at >= ACTS.indexOf("deliberation") ? s.panel : null,
    verdict: at >= ACTS.indexOf("verdict") ? verdictOf(s) : null,
    review: at >= ACTS.indexOf("verdict") ? reviewOf(s, "owner") : null,
  };
}
