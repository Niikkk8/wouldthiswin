// What we keep and for how long. Pure rules, used by the daily job (app/api/cron/retention).
//
// - Answers and the act 3 chat: 30 days. Then the answer text and the chat are deleted.
//   The scores, the odds, the claims and the review stay forever: README badges and public
//   review links point at them.
// - File contents the scan read (`sources`): only until the review is written (applyPanel
//   clears them), and at most 1 day for a session that never got that far.
// - The scan cache (which holds file contents too): 24 hours.

import type { Answer, Panel } from "./session";

export const ANSWERS_DAYS = 30;
export const SOURCES_DAYS = 1;
export const CACHE_HOURS = 24;

const DAY = 24 * 60 * 60 * 1000;

export function cutoffs(now: number) {
  return {
    answers: new Date(now - ANSWERS_DAYS * DAY).toISOString(),
    sources: new Date(now - SOURCES_DAYS * DAY).toISOString(),
    cache: new Date(now - CACHE_HOURS * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * A session past 30 days: the answer text and the chat go. Each answer keeps its score and
 * its marks (silent, late), so the odds still add up; the review is untouched.
 */
export function forgetAnswers(row: { answers: Answer[]; panel: Panel | null }): {
  answers: Answer[];
  panel: Panel | null;
} {
  return {
    answers: row.answers.map((a) => ({ ...a, text: "" })),
    panel: row.panel ? { ...row.panel, chat: [] } : null,
  };
}
