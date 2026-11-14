// Skipping, coming back, and the 24-hour close (lib/session.ts).
import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { SUBMIT_GRACE_MS, deadlineOf } from "./deadline";
import { SILENCE_SCORE, SKIP_DELTA } from "./odds";
import {
  AWAY_AFTER_MS,
  RESUME_WINDOW_MS,
  acceptAnswer,
  advance,
  applyScan,
  grillingProgress,
  isClosed,
  issueQuestion,
  kindOf,
  newSession,
  resumeGrilling,
  settleAnswer,
  skipQuestion,
  toView,
  type Claim,
  type Result,
  type SessionState,
} from "./session";

const T0 = 1_800_000_000_000;

const claims: Claim[] = [
  {
    claim: "Live queue updates",
    status: "backed",
    weight: "core",
    file: "lib/queue.ts",
    evidence: "e",
    label: "Live updates backed",
    missing: null,
    searched: [],
  },
];

const scanned = (): SessionState =>
  unwrap(
    applyScan(newSession("abc", "team/queue"), {
      claims,
      questions: [
        { judge: "tired", text: "What is it?", caught: null },
        { judge: "investor", text: "Who pays?", caught: null },
        { judge: "engineer", text: "What sends the SMS?", caught: null },
      ],
      signals: { demo: { status: "none", url: null }, bulkFirstCommit: false },
      files: ["lib/queue.ts"],
      sources: [],
    }),
  );

function unwrap(r: Result): SessionState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.session;
}

const errorOf = (r: Result) => (r.ok ? null : r.error);
const grilling = () => unwrap(advance(scanned(), "scan", T0));

/** Shows, answers and scores question i. */
function answer(s: SessionState, i: number): SessionState {
  s = unwrap(issueQuestion(s, i, T0));
  s = unwrap(acceptAnswer(s, i, "an answer", T0 + 1_000));
  return unwrap(settleAnswer(s, i, { score: 3, reason: "r" }));
}

/** Question i's buzzer, once it has been shown. */
const deadline = (s: SessionState, i: number) => {
  const q = s.questions[i];
  return deadlineOf({ ...q, kind: kindOf(q), issuedAt: q.issuedAt! }, s.settings);
};

describe("skip this one", () => {
  test("costs a fixed SKIP_DELTA in the Tired Judge's words, with no model score", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    const before = s.events.at(-1)!.after;
    s = unwrap(skipQuestion(s, 0, T0 + 5_000));
    const a = s.answers[0];
    assert.deepEqual([a.skipped, a.silent, a.text, a.score], [true, false, "", null]);
    s = unwrap(settleAnswer(s, 0, null));
    const e = s.events.at(-1)!;
    assert.deepEqual([e.kind, e.delta, e.after], ["skip", SKIP_DELTA, before + SKIP_DELTA]);
    assert.equal(s.answers[0].score, SKIP_DELTA);
    assert.ok(s.answers[0].reason);
  });

  test("is small: cheaper than silence, never a gain", () => {
    assert.ok(SKIP_DELTA < 0);
    assert.ok(SKIP_DELTA > SILENCE_SCORE);
  });

  test("never brings a follow-up", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(skipQuestion(s, 0, T0 + 1_000));
    s = unwrap(settleAnswer(s, 0, { score: 0, reason: "r", followUp: "Really?" }));
    assert.equal(s.questions.length, 3);
  });

  test("only the open question, once, before the buzzer", () => {
    let s = grilling();
    assert.equal(errorOf(skipQuestion(s, 0, T0)), "notIssued");
    s = unwrap(issueQuestion(s, 0, T0));
    assert.equal(errorOf(skipQuestion(s, 1, T0)), "badQuestion");
    assert.equal(errorOf(skipQuestion(s, 0, deadline(s, 0) + SUBMIT_GRACE_MS + 1)), "tooLate");
    s = unwrap(skipQuestion(s, 0, T0 + 1_000));
    assert.equal(errorOf(skipQuestion(s, 0, T0 + 2_000)), "alreadyAnswered");
  });

  test("a grilling of skips still finishes", () => {
    let s = grilling();
    for (let i = 0; i < 3; i++) {
      s = unwrap(issueQuestion(s, i, T0));
      s = unwrap(skipQuestion(s, i, T0 + 1_000));
      s = unwrap(settleAnswer(s, i, null));
    }
    assert.equal(unwrap(advance(s, "grilling", T0)).act, "deliberation");
  });

  test("the view shows a skip as skipped", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(settleAnswer(unwrap(skipQuestion(s, 0, T0 + 1_000)), 0, null));
    assert.equal(toView(s, T0).questions[0].answer?.skipped, true);
  });
});

describe("coming back", () => {
  test("a question whose clock ran out while they were away counts as skipped", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    const back = deadline(s, 0) + 60_000;
    assert.equal(toView(s, back).away, true);
    s = unwrap(resumeGrilling(s, back));
    assert.deepEqual([s.answers[0].skipped, s.answers[0].away], [true, true]);
    s = unwrap(settleAnswer(s, 0, null));
    assert.deepEqual([s.events.at(-1)!.kind, s.events.at(-1)!.delta], ["skip", SKIP_DELTA]);
    assert.equal(toView(s, back).away, false);
  });

  test("the next question starts on a fresh clock, from when it's shown", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    const back = deadline(s, 0) + 600_000;
    s = unwrap(settleAnswer(unwrap(resumeGrilling(s, back)), 0, null));
    s = unwrap(issueQuestion(s, 1, back + 2_000));
    assert.equal(s.questions[1].issuedAt, back + 2_000);
    // The question already seen keeps its old clock: it's never asked again.
    assert.equal(s.questions[0].issuedAt, T0);
    const q = toView(s, back + 2_000).questions[1];
    assert.equal(q.remainingMs, q.windowMs);
  });

  test("a question still on the clock carries on as it is", () => {
    const s = unwrap(issueQuestion(grilling(), 0, T0));
    const r = unwrap(resumeGrilling(s, T0 + 5_000));
    assert.equal(r.answers.length, 0);
    assert.equal(r.questions[0].issuedAt, T0);
    assert.equal(toView(s, T0 + 5_000).away, false);
  });

  test("between questions there's nothing to do", () => {
    const s = answer(grilling(), 0);
    assert.deepEqual(unwrap(resumeGrilling(s, T0 + 999_999)), s);
  });

  test("only in the grilling", () => {
    assert.equal(errorOf(resumeGrilling(scanned(), T0)), "wrongAct");
  });

  test("an empty answer long after the buzzer came from an empty room: skipped, not silence", () => {
    const shown = unwrap(issueQuestion(grilling(), 0, T0));
    const d = deadline(shown, 0);
    const silent = unwrap(acceptAnswer(shown, 0, "", d + SUBMIT_GRACE_MS + 1));
    assert.deepEqual([silent.answers[0].silent, silent.answers[0].skipped], [true, undefined]);
    const away = unwrap(acceptAnswer(shown, 0, "", d + AWAY_AFTER_MS + 1));
    assert.deepEqual([away.answers[0].skipped, away.answers[0].away], [true, true]);
    // Words that arrive late are still late, however late.
    const words = unwrap(acceptAnswer(shown, 0, "hi", d + AWAY_AFTER_MS + 1));
    assert.deepEqual([words.answers[0].silent, words.answers[0].late], [true, true]);
  });
});

describe("24 hours", () => {
  const started = (s: SessionState): SessionState => ({ ...s, createdAt: T0 });
  const after = T0 + RESUME_WINDOW_MS;

  test("an unfinished session closes 24 hours after it started", () => {
    assert.equal(isClosed(started(scanned()), after - 1), false);
    assert.equal(isClosed(started(scanned()), after), true);
    assert.equal(isClosed(started(grilling()), after), true);
    assert.equal(toView(started(grilling()), after).closed, true);
    // Sessions built in memory have no start time and never close.
    assert.equal(isClosed(grilling(), after * 2), false);
  });

  test("closed: no moving on from the scan, no new question, no resume", () => {
    assert.equal(errorOf(advance(started(scanned()), "scan", after)), "closed");
    assert.equal(errorOf(issueQuestion(started(grilling()), 0, after)), "closed");
    assert.equal(errorOf(resumeGrilling(started(grilling()), after)), "closed");
    assert.equal(advance(started(scanned()), "scan", after - 1).ok, true);
  });

  test("a session past the grilling never closes", () => {
    let s = started(grilling());
    for (let i = 0; i < 3; i++) s = answer(s, i);
    s = unwrap(advance(s, "grilling", T0));
    assert.equal(isClosed(s, after * 2), false);
    assert.equal(toView(s, after * 2).closed, false);
  });

  test("the scan's fix list stays on the view until the deliberation", () => {
    assert.ok(Array.isArray(toView(started(scanned()), after).scanFixes));
    assert.ok(Array.isArray(toView(grilling(), T0).scanFixes));
    let s = grilling();
    for (let i = 0; i < 3; i++) s = answer(s, i);
    s = unwrap(advance(s, "grilling", T0));
    assert.equal(toView(s, T0).scanFixes, null);
  });
});

describe("progress", () => {
  test("Question 2 of 3: a follow-up keeps its question's number", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "vague", T0 + 1_000));
    s = unwrap(settleAnswer(s, 0, { score: -3, reason: "r", followUp: "And?" }));
    s = unwrap(issueQuestion(s, 1, T0 + 2_000));
    const v = toView(s, T0 + 2_000);
    assert.deepEqual(
      v.questions.map((q) => [q.number, q.followUp]),
      [
        [1, false],
        [1, true],
      ],
    );
    assert.deepEqual(grillingProgress(v.questions, 1), { number: 1, total: 3, followUp: true });
    // The next one, not shown yet, is question 2.
    assert.deepEqual(grillingProgress(v.questions, 2), { number: 2, total: 3, followUp: false });
    assert.deepEqual(grillingProgress([], 0), { number: 1, total: 3, followUp: false });
  });

  test("never past 3", () => {
    const qs = [1, 2, 3].map((number) => ({ number, followUp: false }));
    assert.equal(grillingProgress(qs, 3).number, 3);
  });
});
