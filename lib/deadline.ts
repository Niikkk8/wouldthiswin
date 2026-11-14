// The grilling clock. The server owns it: every deadline is computed here from the server's
// own timestamps, and the client only displays what the view says is left.
//
// A question's clock starts once it has fully rendered (the word-by-word typing), plus a
// 3-second read grace shown in the UI. Each kind of question gets its own window. Extended
// time doubles the window, with no penalty. The one lifeline adds 30 seconds.
// Typed answers get a short network grace past the deadline. A voice answer whose recording
// started before the deadline also gets an upload grace, so a sentence finished at the
// buzzer still counts.

/** fact: "which file sends the SMS?". decision: "why Postgres?". tradeoff: "why poll, not push?". */
export const QUESTION_KINDS = ["fact", "decision", "tradeoff"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const WINDOW_MS: Record<QuestionKind, number> = {
  fact: 45_000,
  decision: 75_000,
  tradeoff: 90_000,
};
export const READ_GRACE_MS = 3_000;
export const EXTENDED_FACTOR = 2;
export const LIFELINE_MS = 30_000;
/** Typed answers: time for the request to arrive after the clock hits zero. */
export const SUBMIT_GRACE_MS = 3_000;
/** Voice answers: time to upload and transcribe a recording that started before the buzzer. */
export const UPLOAD_GRACE_MS = 5_000;
export const MAX_RECORDING_MS = 90_000;

// The question types out word by word (components/grilling/question-text.tsx): plain words
// first, then the caught phrase, then its underline.
export const WORD_MS = 60;
export const WORD_IN_MS = 300;
export const UNDERLINE_WORD_MS = 180;

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** How long the question takes to type out in full motion, the slowest the client can render it. */
export function typingMs(text: string, caught: string | null): number {
  const caughtWords = caught && text.includes(caught) ? wordCount(caught) : 0;
  const plainWords = wordCount(text) - caughtWords;
  if (!caughtWords) return Math.max(0, plainWords - 1) * WORD_MS + WORD_IN_MS;
  const caughtStart = (plainWords + 2) * WORD_MS;
  const lineStart = caughtStart + caughtWords * WORD_MS + 120;
  return Math.max(
    caughtStart + (caughtWords - 1) * WORD_MS + WORD_IN_MS,
    lineStart + caughtWords * UNDERLINE_WORD_MS,
  );
}

export type Clock = {
  text: string;
  caught: string | null;
  kind: QuestionKind;
  /** Server time the question was first shown. */
  issuedAt: number;
  lifeline?: boolean;
};

export type ClockSettings = { extendedTime: boolean };

export function windowMs(kind: QuestionKind, settings: ClockSettings): number {
  return WINDOW_MS[kind] * (settings.extendedTime ? EXTENDED_FACTOR : 1);
}

/** When the answer clock starts: rendered, then read. */
export function clockStart(q: Clock): number {
  return q.issuedAt + typingMs(q.text, q.caught) + READ_GRACE_MS;
}

export function deadlineOf(q: Clock, settings: ClockSettings): number {
  return clockStart(q) + windowMs(q.kind, settings) + (q.lifeline ? LIFELINE_MS : 0);
}

/** A typed answer counts until the deadline plus the network grace. */
export function acceptsTyped(q: Clock, settings: ClockSettings, now: number): boolean {
  return now <= deadlineOf(q, settings) + SUBMIT_GRACE_MS;
}

/** A recording may start any time before the buzzer. */
export function acceptsRecordingStart(q: Clock, settings: ClockSettings, now: number): boolean {
  return now < deadlineOf(q, settings);
}

/** The audio upload: the recording started before the buzzer, and it arrives within the upload grace. */
export function acceptsUpload(
  q: Clock,
  settings: ClockSettings,
  recordingStartedAt: number | null,
  now: number,
): boolean {
  const deadline = deadlineOf(q, settings);
  return (
    recordingStartedAt !== null &&
    recordingStartedAt < deadline &&
    now <= deadline + UPLOAD_GRACE_MS
  );
}

/** The answer after a voice recording: the upload grace plus the network grace. */
export function acceptsSpoken(
  q: Clock,
  settings: ClockSettings,
  recordingStartedAt: number | null,
  now: number,
): boolean {
  if (recordingStartedAt === null || recordingStartedAt >= deadlineOf(q, settings))
    return acceptsTyped(q, settings, now);
  return now <= deadlineOf(q, settings) + UPLOAD_GRACE_MS + SUBMIT_GRACE_MS;
}

/** The lifeline can be pulled while the clock is still running. */
export function acceptsLifeline(q: Clock, settings: ClockSettings, now: number): boolean {
  return !q.lifeline && now < deadlineOf(q, settings);
}

/** What the client shows: time left to read, then time left to answer. Never negative. */
export function clockView(q: Clock, settings: ClockSettings, now: number) {
  return {
    readMs: Math.max(0, clockStart(q) - now),
    remainingMs: Math.max(0, deadlineOf(q, settings) - Math.max(now, clockStart(q))),
    windowMs: windowMs(q.kind, settings) + (q.lifeline ? LIFELINE_MS : 0),
  };
}
