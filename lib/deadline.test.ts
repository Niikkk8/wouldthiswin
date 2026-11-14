import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  LIFELINE_MS,
  READ_GRACE_MS,
  SUBMIT_GRACE_MS,
  UPLOAD_GRACE_MS,
  WINDOW_MS,
  WORD_IN_MS,
  WORD_MS,
  acceptsLifeline,
  acceptsRecordingStart,
  acceptsSpoken,
  acceptsTyped,
  acceptsUpload,
  clockStart,
  clockView,
  deadlineOf,
  typingMs,
  type Clock,
} from "./deadline";

const NORMAL = { extendedTime: false };
const EXTENDED = { extendedTime: true };
const T0 = 1_000_000;

const q = (over: Partial<Clock> = {}): Clock => ({
  text: "In one sentence. What is it?",
  caught: null,
  kind: "fact",
  issuedAt: T0,
  ...over,
});

describe("typing time", () => {
  test("plain words land one every 60ms", () => {
    assert.equal(typingMs("one two three", null), 2 * WORD_MS + WORD_IN_MS);
  });

  test("a caught phrase comes in last, then its underline draws", () => {
    const plain = typingMs("Which file sends the SMS alerts?", null);
    const caught = typingMs("Which file sends the SMS alerts?", "SMS alerts");
    assert.ok(caught > plain);
  });

  test("a caught phrase that isn't in the text is ignored", () => {
    assert.equal(typingMs("one two", "missing"), typingMs("one two", null));
  });
});

describe("the clock", () => {
  test("starts after the question has rendered, plus the 3-second read", () => {
    assert.equal(clockStart(q()), T0 + typingMs(q().text, null) + READ_GRACE_MS);
  });

  test("each kind of question gets its own window: 45, 75, 90 seconds", () => {
    assert.deepEqual(WINDOW_MS, { fact: 45_000, decision: 75_000, tradeoff: 90_000 });
    for (const kind of ["fact", "decision", "tradeoff"] as const) {
      assert.equal(deadlineOf(q({ kind }), NORMAL) - clockStart(q({ kind })), WINDOW_MS[kind]);
    }
  });

  test("extended time doubles the window", () => {
    assert.equal(deadlineOf(q({ kind: "decision" }), EXTENDED) - clockStart(q()), 150_000);
  });

  test("the lifeline adds 30 seconds, extended or not", () => {
    assert.equal(deadlineOf(q({ lifeline: true }), NORMAL) - deadlineOf(q(), NORMAL), LIFELINE_MS);
    assert.equal(
      deadlineOf(q({ lifeline: true }), EXTENDED) - deadlineOf(q(), EXTENDED),
      LIFELINE_MS,
    );
  });
});

describe("typed answers", () => {
  const d = deadlineOf(q(), NORMAL);

  test("count up to the deadline plus the network grace", () => {
    assert.equal(acceptsTyped(q(), NORMAL, d), true);
    assert.equal(acceptsTyped(q(), NORMAL, d + SUBMIT_GRACE_MS), true);
    assert.equal(acceptsTyped(q(), NORMAL, d + SUBMIT_GRACE_MS + 1), false);
  });

  test("time spent reading is never taken from the answer", () => {
    assert.equal(acceptsTyped(q(), NORMAL, clockStart(q()) + WINDOW_MS.fact), true);
  });

  test("extended time moves the buzzer", () => {
    assert.equal(acceptsTyped(q(), NORMAL, d + 10_000), false);
    assert.equal(acceptsTyped(q(), EXTENDED, d + 10_000), true);
  });
});

describe("voice answers", () => {
  const d = deadlineOf(q(), NORMAL);

  test("a recording may start until the buzzer, not at it", () => {
    assert.equal(acceptsRecordingStart(q(), NORMAL, d - 1), true);
    assert.equal(acceptsRecordingStart(q(), NORMAL, d), false);
  });

  test("the upload counts if recording started in time and it arrives within 5 seconds", () => {
    assert.equal(acceptsUpload(q(), NORMAL, d - 2_000, d + UPLOAD_GRACE_MS), true);
    assert.equal(acceptsUpload(q(), NORMAL, d - 2_000, d + UPLOAD_GRACE_MS + 1), false);
    assert.equal(acceptsUpload(q(), NORMAL, d, d + 1), false);
    assert.equal(acceptsUpload(q(), NORMAL, null, d - 1), false);
  });

  test("the transcript answer gets the upload grace on top of the network grace", () => {
    const late = d + UPLOAD_GRACE_MS + SUBMIT_GRACE_MS;
    assert.equal(acceptsSpoken(q(), NORMAL, d - 1_000, late), true);
    assert.equal(acceptsSpoken(q(), NORMAL, d - 1_000, late + 1), false);
  });

  test("without a recording that started in time, a spoken answer is a typed one", () => {
    assert.equal(acceptsSpoken(q(), NORMAL, null, d + SUBMIT_GRACE_MS + 1), false);
    assert.equal(acceptsSpoken(q(), NORMAL, d + 1, d + SUBMIT_GRACE_MS + 1), false);
  });

  test("extended time stretches the voice deadline too", () => {
    const de = deadlineOf(q(), EXTENDED);
    assert.equal(acceptsUpload(q(), EXTENDED, de - 1, de + UPLOAD_GRACE_MS), true);
    assert.equal(acceptsUpload(q(), NORMAL, de - 1, de), false);
  });
});

describe("lifeline", () => {
  test("only while the clock runs, and only once", () => {
    const d = deadlineOf(q(), NORMAL);
    assert.equal(acceptsLifeline(q(), NORMAL, d - 1), true);
    assert.equal(acceptsLifeline(q(), NORMAL, d), false);
    assert.equal(acceptsLifeline(q({ lifeline: true }), NORMAL, T0), false);
  });
});

describe("what the client sees", () => {
  test("read time first, then the whole window", () => {
    const v = clockView(q(), NORMAL, T0);
    assert.equal(v.readMs, clockStart(q()) - T0);
    assert.equal(v.remainingMs, WINDOW_MS.fact);
    assert.equal(v.windowMs, WINDOW_MS.fact);
  });

  test("counts down once the clock starts, and stops at zero", () => {
    const start = clockStart(q());
    assert.deepEqual(clockView(q(), NORMAL, start + 5_000), {
      readMs: 0,
      remainingMs: 40_000,
      windowMs: 45_000,
    });
    assert.equal(clockView(q(), NORMAL, start + 999_999).remainingMs, 0);
  });

  test("the lifeline shows as a longer window", () => {
    assert.equal(clockView(q({ lifeline: true }), NORMAL, T0).windowMs, 75_000);
  });
});
