import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SILENCE_SCORE } from "./odds";
import {
  ANSWER_GRACE_MS,
  ANSWER_WINDOW_MS,
  type Claim,
  type Panel,
  type Result,
  type ScanSignals,
  type SessionState,
  acceptAnswer,
  advance,
  applyPanel,
  applyScan,
  issueQuestion,
  newSession,
  settleAnswer,
  toView,
  verdictOf,
} from "./session";

const T0 = 1_800_000_000_000;

const claims: Claim[] = [
  { claim: "Live queue updates", status: "backed", weight: "core", file: "lib/queue.ts", evidence: "e", label: "Live updates backed", missing: null, searched: [] },
  { claim: "SMS alerts", status: "unbacked", weight: "core", file: null, evidence: "e", label: "SMS claim unbacked", missing: "SMS provider", searched: ["package.json"] },
  { claim: "Any hospital", status: "unclear", weight: "core", file: "config/hospital.ts", evidence: "e", label: "One hardcoded hospital", missing: null, searched: [] },
];

const questions = [
  { judge: "tired" as const, text: "What is it?", caught: null },
  { judge: "investor" as const, text: "Who pays?", caught: null },
  { judge: "engineer" as const, text: "What sends the SMS?", caught: "no SMS provider" },
];

const noSignals: ScanSignals = { demo: { status: "none", url: null }, bulkFirstCommit: false };
const files = ["lib/queue.ts", "config/hospital.ts", "package.json"];
const scan = (c = claims, signals = noSignals) => ({ claims: c, questions, signals, files, sources: [] });

const panel: Panel = { chat: [], oneLiner: "the one that texts you", fixes: ["a", "b", "c"], charge: "of overpromising" };

function unwrap(r: Result): SessionState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.session;
}

function scanned(): SessionState {
  return unwrap(applyScan(newSession("abc", "latenight/queue-less"), scan()));
}

function grilling(): SessionState {
  return unwrap(advance(scanned(), "scan"));
}

/** Shows, answers and scores question i. */
function answer(s: SessionState, i: number, text: string, at: number, score = 3): SessionState {
  s = unwrap(issueQuestion(s, i, at));
  s = unwrap(acceptAnswer(s, i, text, at + 1_000));
  return unwrap(settleAnswer(s, i, { score, reason: "r" }));
}

describe("scan", () => {
  test("one event per claim, starting at 50", () => {
    const s = scanned();
    assert.deepEqual(
      s.events.map((e) => [e.delta, e.after]),
      [
        [6, 56],
        [-19, 37],
        [-2, 35],
      ],
    );
  });

  test("a demo link that loads and a bulk first commit each add an event after the claims", () => {
    const s = unwrap(
      applyScan(
        newSession("abc", "r"),
        scan(claims, { demo: { status: "loads", url: "https://x.vercel.app" }, bulkFirstCommit: true }),
      ),
    );
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.delta, e.after]),
      [
        ["claim", 6, 56],
        ["claim", -19, 37],
        ["claim", -2, 35],
        ["demo", 5, 40],
        ["commits", -10, 30],
      ],
    );
    assert.equal(s.events[4].reason, "Most of the code arrived in one commit.");
  });

  test("a dead demo link costs 8; no link adds no event", () => {
    const dead = unwrap(
      applyScan(newSession("abc", "r"), scan([], { demo: { status: "dead", url: "https://x" }, bulkFirstCommit: false })),
    );
    assert.deepEqual(dead.events.map((e) => [e.kind, e.delta]), [["demo", -8]]);
    const none = unwrap(applyScan(newSession("abc", "r"), scan([])));
    assert.equal(none.events.length, 0);
  });

  test("a long README can't farm points: the scan adds at most 20", () => {
    const backed = Array.from({ length: 6 }, () => claims[0]);
    const s = unwrap(
      applyScan(newSession("abc", "r"), scan(backed, { demo: { status: "loads", url: "https://x.vercel.app" }, bulkFirstCommit: false })),
    );
    assert.deepEqual(s.events.map((e) => e.delta), [6, 6, 6, 2, 0, 0, 0]);
    assert.equal(s.events.at(-1)!.after, 70);
  });

  test("the scan takes at most 30", () => {
    const unbacked = Array.from({ length: 3 }, () => claims[1]);
    const s = unwrap(
      applyScan(newSession("abc", "r"), scan(unbacked, { demo: { status: "dead", url: "https://x" }, bulkFirstCommit: true })),
    );
    assert.deepEqual(s.events.map((e) => e.delta), [-19, -11, 0, 0, 0]);
    assert.equal(s.events.at(-1)!.after, 20);
  });

  test("a gain after hitting the floor still counts", () => {
    const s = unwrap(applyScan(newSession("abc", "r"), scan([claims[1], claims[1], claims[0]])));
    assert.deepEqual(s.events.map((e) => [e.delta, e.after]), [[-19, 31], [-11, 20], [6, 26]]);
  });

  test("runs once", () => {
    const r = applyScan(scanned(), scan());
    assert.deepEqual(r, { ok: false, error: "alreadyScanned" });
  });
});

describe("act order", () => {
  test("an act skip is rejected", () => {
    const s = scanned();
    // At the scan, asking to leave the grilling (i.e. jump to deliberation) fails.
    assert.deepEqual(advance(s, "grilling"), { ok: false, error: "wrongAct" });
    assert.deepEqual(advance(s, "verdict"), { ok: false, error: "wrongAct" });
    assert.equal(s.act, "scan");
  });

  test("a repeated advance is rejected", () => {
    const s = grilling();
    assert.deepEqual(advance(s, "scan"), { ok: false, error: "wrongAct" });
  });

  test("the scan can't be left before it has run", () => {
    assert.deepEqual(advance(newSession("abc", "r"), "scan"), { ok: false, error: "actIncomplete" });
  });

  test("the grilling can't be left with questions unanswered", () => {
    let s = grilling();
    s = answer(s, 0, "It texts patients.", T0);
    assert.deepEqual(advance(s, "grilling"), { ok: false, error: "actIncomplete" });
  });

  test("walks forward one act at a time to the share screen, then stops", () => {
    let s = grilling();
    s = answer(s, 0, "a", T0);
    s = answer(s, 1, "b", T0 + 60_000);
    s = answer(s, 2, "c", T0 + 120_000);
    assert.deepEqual(advance(s, "grilling"), { ok: false, error: "actIncomplete" }); // no panel yet
    s = unwrap(applyPanel(s, panel));
    for (const act of ["grilling", "deliberation", "verdict"] as const) s = unwrap(advance(s, act));
    assert.equal(s.act, "share");
    assert.deepEqual(advance(s, "share"), { ok: false, error: "wrongAct" });
  });
});

describe("answers", () => {
  test("a late answer is scored as silence", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "A long, considered answer.", T0 + ANSWER_WINDOW_MS + ANSWER_GRACE_MS + 1));
    assert.equal(s.answers[0].silent, true);
    assert.equal(s.answers[0].late, true);
    assert.equal(s.answers[0].text, "");

    // The model's score is ignored for a late answer.
    s = unwrap(settleAnswer(s, 0, { score: 12, reason: "great" }));
    assert.equal(s.answers[0].score, SILENCE_SCORE);
    assert.equal(s.events.at(-1)!.delta, SILENCE_SCORE);
  });

  test("an answer inside the grace period counts", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "Just in time.", T0 + ANSWER_WINDOW_MS + ANSWER_GRACE_MS));
    assert.equal(s.answers[0].silent, false);
    assert.equal(s.answers[0].text, "Just in time.");
  });

  test("an empty answer is silence", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "   ", T0 + 5_000));
    assert.equal(s.answers[0].silent, true);
    assert.equal(s.answers[0].late, false);
  });

  test("a duplicate answer is rejected", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "First.", T0 + 1_000));
    assert.deepEqual(acceptAnswer(s, 0, "Second.", T0 + 2_000), { ok: false, error: "alreadyAnswered" });
    assert.equal(s.answers.length, 1);
  });

  test("a duplicate score is rejected", () => {
    const s = answer(grilling(), 0, "First.", T0);
    assert.deepEqual(settleAnswer(s, 0, { score: 12, reason: "again" }), { ok: false, error: "alreadyScored" });
  });

  test("a question must be shown before it can be answered", () => {
    assert.deepEqual(acceptAnswer(grilling(), 0, "x", T0), { ok: false, error: "notIssued" });
  });

  test("questions go in order", () => {
    const s = grilling();
    assert.deepEqual(issueQuestion(s, 1, T0), { ok: false, error: "badQuestion" });
    assert.deepEqual(acceptAnswer(s, 2, "x", T0), { ok: false, error: "badQuestion" });
  });

  test("showing a question again doesn't restart its clock", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(issueQuestion(s, 0, T0 + 20_000));
    assert.equal(s.questions[0].issuedAt, T0);
  });

  test("model scores are clamped", () => {
    const s = answer(grilling(), 0, "x", T0, 500);
    assert.equal(s.answers[0].score, 12);
  });

  test("a spoken answer needs a score", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "x", T0 + 1_000));
    assert.deepEqual(settleAnswer(s, 0, null), { ok: false, error: "needsScore" });
  });

  test("answers are only taken during the grilling", () => {
    assert.deepEqual(acceptAnswer(scanned(), 0, "x", T0), { ok: false, error: "wrongAct" });
  });
});

describe("verdict", () => {
  test("guilty when a core claim is unbacked, with the panel's charge", () => {
    let s = grilling();
    s = answer(s, 0, "a", T0, 5);
    s = answer(s, 1, "b", T0, 2);
    s = answer(s, 2, "c", T0, -4);
    s = unwrap(applyPanel(s, panel));
    assert.deepEqual(verdictOf(s), { odds: 38, tier: "honorable", charge: "of overpromising" });
  });

  test("not guilty otherwise", () => {
    const s = unwrap(
      applyScan(newSession("abc", "r"), scan([claims[0], claims[2]])),
    );
    assert.equal(verdictOf(s).charge, null);
  });
});

describe("view", () => {
  test("questions stay hidden until shown", () => {
    let s = grilling();
    assert.equal(toView(s, T0).questions.length, 0);
    s = unwrap(issueQuestion(s, 0, T0));
    const v = toView(s, T0 + 10_000);
    assert.equal(v.questions.length, 1);
    assert.equal(v.questions[0].remainingMs, 20_000);
    assert.equal(v.questionCount, 3);
  });

  test("the panel stays hidden until deliberation", () => {
    let s = grilling();
    s = answer(s, 0, "a", T0);
    s = answer(s, 1, "b", T0);
    s = answer(s, 2, "c", T0);
    s = unwrap(applyPanel(s, panel));
    assert.equal(toView(s, T0).panel, null);
    assert.equal(toView(s, T0).verdict, null);
    s = unwrap(advance(s, "grilling"));
    assert.deepEqual(toView(s, T0).panel, panel);
    assert.equal(toView(s, T0).verdict, null);
  });
});
