// Looking up event presets, their state, and the rubric a session is judged on.

import { DEFAULT_RUBRIC, type Rubric } from "../rubric";
import { FIXTURE_EVENT } from "./fixture";
import { EVENT_PRESETS } from "./presets";
import type { EventPreset } from "./types";

type Env = Record<string, string | undefined>;

/** Real presets everywhere; the made-up fixture too, outside production. */
export function allEvents(env: Env = process.env): EventPreset[] {
  return env.NODE_ENV === "production" ? EVENT_PRESETS : [...EVENT_PRESETS, FIXTURE_EVENT];
}

export function eventBySlug(
  slug: string | null | undefined,
  env: Env = process.env,
): EventPreset | null {
  if (!slug) return null;
  return allEvents(env).find((e) => e.slug === slug) ?? null;
}

export type EventStatus = "upcoming" | "open" | "closed";

/**
 * Upcoming before it starts, closed once the deadline passes, open in between. An event with
 * only a deadline text (no exact time) stays open: the page says the deadline in words.
 */
export function eventStatus(e: Pick<EventPreset, "startsAt" | "endsAt">, now: number): EventStatus {
  if (now < Date.parse(e.startsAt)) return "upcoming";
  if (e.endsAt && now >= Date.parse(e.endsAt)) return "closed";
  return "open";
}

/** The rubric a session is judged on: its event's, or the default. */
export function rubricFor(slug: string | null | undefined): Rubric {
  return eventBySlug(slug)?.rubric ?? DEFAULT_RUBRIC;
}

/** The note an event adds to the judges' prompts, or nothing. */
export function judgeContextFor(slug: string | null | undefined): string {
  return eventBySlug(slug)?.judgeContext ?? "";
}

/**
 * The event note as a prompt block. It's our own config, never the team's text, so it sits
 * outside the untrusted delimiters; it goes in the user message so the system prompt stays cached.
 */
export function eventBlock(context: string): string[] {
  return context ? [`<event_context>\n${context}\n</event_context>`] : [];
}
