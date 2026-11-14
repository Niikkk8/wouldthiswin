import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { LIFELINE_MS, SUBMIT_GRACE_MS, WINDOW_MS, clockStart, deadlineOf } from "./deadline";
import { LIFELINE_DELTA, SILENCE_SCORE } from "./odds";
import {
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
  nextVisibility,
  settleAnswer,
  toView,
  pullLifeline,
  withFollowUp,
  verdictOf,
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
  {
    claim: "SMS alerts",
    status: "unbacked",
    weight: "core",
    file: null,
    evidence: "e",
    label: "SMS claim unbacked",
    missing: "SMS provider",
    searched: ["package.json"],
  },
  {
    claim: "Any hospital",
    status: "unclear",
    weight: "core",
    file: "config/hospital.ts",
    evidence: "e",
    label: "One hardcoded hospital",
    missing: null,
    searched: [],
  },
];

const questions = [
  { judge: "tired" as const, text: "What is it?", caught: null },
  { judge: "investor" as const, text: "Who pays?", caught: null },
  { judge: "engineer" as const, text: "What sends the SMS?", caught: "no SMS provider" },
];

const noSignals: ScanSignals = { demo: { status: "none", url: null }, bulkFirstCommit: false };
const files = ["lib/queue.ts", "config/hospital.ts", "package.json"];
const scan = (c = claims, signals = noSignals) => ({
  claims: c,
  questions,
  signals,
  files,
  sources: [],
});

const panel: Panel = {
  chat: [],
  oneLiner: "the one that texts you",
  fixes: ["a", "b", "c"],
  reviews: {
    tired: { status: "commented", comment: null },
    investor: { status: "approved", comment: null },
    engineer: { status: "changesRequested", comment: null },
  },
};

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
        scan(claims, {
          demo: { status: "loads", url: "https://x.vercel.app" },
          bulkFirstCommit: true,
        }),
      ),
    );
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.delta, e.after]),
      [
        ["claim", 6, 56],
        ["claim", -19, 37],
        ["claim", -2, 35],
        ["demo", 8, 43],
        ["commits", -10, 33],
      ],
    );
    assert.equal(s.events[4].reason, "Most of the code arrived in one commit.");
  });

  test("a dead demo link costs 8; no link adds no event", () => {
    const dead = unwrap(
      applyScan(
        newSession("abc", "r"),
        scan([], { demo: { status: "dead", url: "https://x" }, bulkFirstCommit: false }),
      ),
    );
    assert.deepEqual(
      dead.events.map((e) => [e.kind, e.delta]),
      [["demo", -8]],
    );
    const none = unwrap(applyScan(newSession("abc", "r"), scan([])));
    assert.equal(none.events.length, 0);
  });

  test("a long README can't farm points: the scan adds at most 20", () => {
    const backed = Array.from({ length: 6 }, () => claims[0]);
    const s = unwrap(
      applyScan(
        newSession("abc", "r"),
        scan(backed, {
          demo: { status: "loads", url: "https://x.vercel.app" },
          bulkFirstCommit: false,
        }),
      ),
    );
    assert.deepEqual(
      s.events.map((e) => e.delta),
      [6, 6, 6, 2, 0, 0, 0],
    );
    assert.equal(s.events.at(-1)!.after, 70);
  });

  test("the scan takes at most 30", () => {
    const unbacked = Array.from({ length: 3 }, () => claims[1]);
    const s = unwrap(
      applyScan(
        newSession("abc", "r"),
        scan(unbacked, { demo: { status: "dead", url: "https://x" }, bulkFirstCommit: true }),
      ),
    );
    assert.deepEqual(
      s.events.map((e) => e.delta),
      [-19, -11, 0, 0, 0],
    );
    assert.equal(s.events.at(-1)!.after, 20);
  });

  test("a gain after hitting the floor still counts", () => {
    const s = unwrap(applyScan(newSession("abc", "r"), scan([claims[1], claims[1], claims[0]])));
    assert.deepEqual(
      s.events.map((e) => [e.delta, e.after]),
      [
        [-19, 31],
        [-11, 20],
        [6, 26],
      ],
    );
  });

  test("a demo video that resolves adds 4", () => {
    const s = unwrap(
      applyScan(
        newSession("abc", "r"),
        scan([], {
          demo: { status: "video", url: "https://youtu.be/abcdefghijk", provided: true },
          bulkFirstCommit: false,
        }),
      ),
    );
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.delta, e.reason]),
      [["demo", 4, "Demo video resolves"]],
    );
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
    assert.deepEqual(advance(newSession("abc", "r"), "scan"), {
      ok: false,
      error: "actIncomplete",
    });
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
    s = unwrap(advance(s, "grilling"));
    // Act 3 can't be left before the panel has deliberated.
    assert.deepEqual(advance(s, "deliberation"), { ok: false, error: "actIncomplete" });
    s = unwrap(applyPanel(s, panel));
    for (const act of ["deliberation", "verdict"] as const) s = unwrap(advance(s, act));
    assert.equal(s.act, "share");
    assert.deepEqual(advance(s, "share"), { ok: false, error: "wrongAct" });
  });
});

/** The first question's buzzer: a quick fact from the Tired Judge, issued at T0. */
const buzzer = (extendedTime = false, lifeline = false) =>
  deadlineOf(
    { text: questions[0].text, caught: null, kind: "fact", issuedAt: T0, lifeline },
    { extendedTime },
  );

describe("answers", () => {
  test("a late answer is scored as silence", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "A long, considered answer.", buzzer() + SUBMIT_GRACE_MS + 1));
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
    s = unwrap(acceptAnswer(s, 0, "Just in time.", buzzer() + SUBMIT_GRACE_MS));
    assert.equal(s.answers[0].silent, false);
    assert.equal(s.answers[0].text, "Just in time.");
  });

  test("extended time doubles the window, with no penalty", () => {
    let s = unwrap(issueQuestion({ ...grilling(), settings: { extendedTime: true } }, 0, T0));
    s = unwrap(acceptAnswer(s, 0, "Took my time.", buzzer() + 30_000));
    assert.equal(s.answers[0].silent, false);
    assert.equal(s.events.length, grilling().events.length);
  });

  test("a spoken answer gets no extra time: past the network grace it's late", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "Said it out loud.", buzzer() + SUBMIT_GRACE_MS + 1));
    assert.equal(s.answers[0].late, true);
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
    assert.deepEqual(acceptAnswer(s, 0, "Second.", T0 + 2_000), {
      ok: false,
      error: "alreadyAnswered",
    });
    assert.equal(s.answers.length, 1);
  });

  test("a duplicate score is rejected", () => {
    const s = answer(grilling(), 0, "First.", T0);
    assert.deepEqual(settleAnswer(s, 0, { score: 12, reason: "again" }), {
      ok: false,
      error: "alreadyScored",
    });
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

describe("lifeline", () => {
  test("adds 30 seconds and costs a fixed 2 points at once", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    const before = s.events.at(-1)!.after;
    s = unwrap(pullLifeline(s, 0, T0 + 5_000));
    assert.equal(s.questions[0].lifeline, true);
    assert.equal(s.events.at(-1)!.kind, "lifeline");
    assert.equal(s.events.at(-1)!.delta, LIFELINE_DELTA);
    assert.equal(s.events.at(-1)!.after, before - 2);
    s = unwrap(acceptAnswer(s, 0, "With the extra time.", buzzer() + LIFELINE_MS));
    assert.equal(s.answers[0].silent, false);
  });

  test("once per session", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(pullLifeline(s, 0, T0));
    s = answer(s, 0, "a", T0 + 1_000);
    s = unwrap(issueQuestion(s, 1, T0 + 2_000));
    assert.deepEqual(pullLifeline(s, 1, T0 + 3_000), { ok: false, error: "lifelineUsed" });
    assert.equal(toView(s, T0).lifelineAvailable, false);
  });

  test("not after the buzzer, and not on a question that isn't open", () => {
    const s = unwrap(issueQuestion(grilling(), 0, T0));
    assert.deepEqual(pullLifeline(s, 0, buzzer()), { ok: false, error: "tooLate" });
    assert.deepEqual(pullLifeline(grilling(), 0, T0), { ok: false, error: "notIssued" });
    assert.deepEqual(pullLifeline(s, 1, T0), { ok: false, error: "badQuestion" });
  });
});

describe("verdict", () => {
  test("changes requested when a core claim is missing from the code", () => {
    let s = grilling();
    s = answer(s, 0, "a", T0, 5);
    s = answer(s, 1, "b", T0, 2);
    s = answer(s, 2, "c", T0, -4);
    assert.deepEqual(verdictOf(s), { odds: 38, tier: "honorable", readyToWin: false });
  });

  test("ready to win at 55 or more with every core claim found or unclear", () => {
    let s = unwrap(
      advance(unwrap(applyScan(newSession("abc", "r"), scan([claims[0], claims[2]]))), "scan"),
    );
    s = answer(s, 0, "a", T0, 6);
    assert.deepEqual(verdictOf(s), { odds: 60, tier: "top3", readyToWin: true });
  });
});

describe("deliberation", () => {
  test("the panel is written once, and only in act 3", () => {
    let s = grilling();
    assert.deepEqual(applyPanel(s, panel), { ok: false, error: "wrongAct" });
    s = answer(s, 0, "a", T0);
    s = answer(s, 1, "b", T0);
    s = answer(s, 2, "c", T0);
    s = unwrap(advance(s, "grilling"));
    s = unwrap(applyPanel(s, panel));
    assert.deepEqual(applyPanel(s, panel), { ok: false, error: "alreadyDeliberated" });
  });

  test("writing the review clears the file contents the scan read", () => {
    let s = grilling();
    s = { ...s, sources: [{ path: "lib/queue.ts", text: "export const x = 1;" }] };
    s = answer(s, 0, "a", T0);
    s = answer(s, 1, "b", T0);
    s = answer(s, 2, "c", T0);
    s = unwrap(advance(s, "grilling"));
    assert.equal(s.sources.length, 1);
    s = unwrap(applyPanel(s, panel));
    assert.deepEqual(s.sources, []);
  });
});

describe("view", () => {
  test("questions stay hidden until shown", () => {
    let s = grilling();
    assert.equal(toView(s, T0).questions.length, 0);
    s = unwrap(issueQuestion(s, 0, T0));
    const start = clockStart({ text: questions[0].text, caught: null, kind: "fact", issuedAt: T0 });
    const reading = toView(s, T0);
    assert.equal(reading.questions[0].readMs, start - T0);
    assert.equal(reading.questions[0].remainingMs, WINDOW_MS.fact);
    const v = toView(s, start + 10_000);
    assert.equal(v.questions.length, 1);
    assert.equal(v.questions[0].readMs, 0);
    assert.equal(v.questions[0].remainingMs, 35_000);
    assert.equal(v.questions[0].kind, "fact");
    assert.equal(v.questionCount, 3);
  });

  test("the review stays hidden until act 4", () => {
    let s = grilling();
    s = answer(s, 0, "a", T0);
    s = answer(s, 1, "b", T0);
    s = answer(s, 2, "c", T0);
    s = unwrap(advance(s, "grilling"));
    s = unwrap(applyPanel(s, panel));
    assert.deepEqual(toView(s, T0).panel, panel);
    assert.equal(toView(s, T0).verdict, null);
    assert.equal(toView(s, T0).review, null);
    s = unwrap(advance(s, "deliberation"));
    assert.equal(toView(s, T0).review?.oneLiner, "the one that texts you");
  });
});

describe("a re-review", () => {
  test("each fix checked becomes an event after the scan, outside the scan's cap", () => {
    const backed: Claim[] = Array.from({ length: 5 }, (_, i) => ({ ...claims[0], claim: `c${i}` }));
    const iteration = {
      previousId: "abcdefghjk",
      previousOdds: 40,
      commits: 3,
      filesChanged: 2,
      fixes: [
        {
          fix: "Send a real text from notify.ts",
          status: "addressed" as const,
          file: "server/notify.ts",
          quote: "q",
          note: "n",
        },
        {
          fix: "Put the demo link at the top",
          status: "partly" as const,
          file: "README.md",
          quote: "q",
          note: "n",
        },
        {
          fix: "Load hospitals from the database",
          status: "untouched" as const,
          file: null,
          quote: null,
          note: "n",
        },
      ],
    };
    const s = unwrap(applyScan(newSession("abc", "r"), scan(backed, { ...noSignals, iteration })));
    // Five backed core claims hit the +20 cap at 70; the fixes still count.
    assert.deepEqual(
      s.events.filter((e) => e.kind === "iteration").map((e) => [e.delta, e.after, e.reason]),
      [
        [4, 74, "Done: Send a real text from notify.ts"],
        [2, 76, "Started: Put the demo link at the top"],
        [0, 76, "Still open: Load hospitals from the database"],
      ],
    );
  });
});

describe("visibility", () => {
  test("both opt-ins start off", () => {
    assert.deepEqual(newSession("abc", "r").visibility, { shareable: false, listed: false });
  });

  test("listing needs sharing; turning sharing off unlists", () => {
    const off = { shareable: false, listed: false };
    assert.deepEqual(nextVisibility(off, { listed: true }), off);
    const shared = nextVisibility(off, { shareable: true });
    assert.deepEqual(nextVisibility(shared, { listed: true }), { shareable: true, listed: true });
    assert.deepEqual(nextVisibility({ shareable: true, listed: true }, { shareable: false }), off);
  });
});

describe("follow-ups", () => {
  test("a vague answer brings one follow-up from the same judge, asked next, as a quick fact", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "It's AI.", T0 + 1_000));
    s = unwrap(
      settleAnswer(s, 0, { score: -5, reason: "vague", followUp: "Which model, in which file?" }),
    );
    assert.equal(s.questions.length, 4);
    assert.deepEqual(
      [s.questions[1].judge, s.questions[1].text, s.questions[1].kind, s.questions[1].followUpOf],
      ["tired", "Which model, in which file?", "fact", 0],
    );
    assert.equal(s.questions[2].judge, "investor");
    assert.equal(toView(unwrap(issueQuestion(s, 1, T0 + 2_000)), T0).questions[1].followUp, true);
  });

  test("never a follow-up to a follow-up, and at most two a session", () => {
    let qs = grilling().questions;
    qs = withFollowUp(qs, 0, "a?");
    assert.equal(withFollowUp(qs, 1, "b?").length, qs.length);
    qs = withFollowUp(qs, 2, "c?");
    assert.equal(qs.length, 5);
    assert.equal(withFollowUp(qs, 4, "d?").length, 5);
  });

  test("a silent answer gets no follow-up", () => {
    let s = unwrap(issueQuestion(grilling(), 0, T0));
    s = unwrap(acceptAnswer(s, 0, "", T0 + 1_000));
    s = unwrap(settleAnswer(s, 0, { score: 0, reason: "r", followUp: "Hello?" }));
    assert.equal(s.questions.length, 3);
  });
});
