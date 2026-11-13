// An event preset: everything that changes when a session runs for a specific hackathon.
// Presets are plain data (lib/events/presets.ts), checked against this schema by the tests,
// so adding a real hackathon is a config-only change.

import { z } from "zod";

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);

const Criterion = z.object({
  key: Slug,
  name: z.string().min(1).max(60),
  weight: z.number().positive().max(100),
  description: z.string().min(1).max(240),
});

/** How a sponsor's track is detected in a repo (F16). Lowercase package names, import paths, API hosts. */
export const SponsorSignature = z.object({
  sponsor: z.string().min(1).max(60),
  track: z.string().min(1).max(80),
  detect: z.object({
    packages: z.array(z.string().min(1)).default([]),
    imports: z.array(z.string().min(1)).default([]),
    hosts: z.array(z.string().min(1)).default([]),
  }),
});

export const EventPreset = z
  .object({
    slug: Slug,
    name: z.string().min(1).max(80),
    url: z.string().url(),
    /** ISO 8601 with a timezone. */
    startsAt: z.string().datetime({ offset: true }),
    /** When submissions close, if known exactly. */
    endsAt: z.string().datetime({ offset: true }).nullable(),
    /** What the event says about its deadline when there's no exact time, e.g. "Sunday noon, local time". */
    deadlineText: z.string().max(120).nullable(),
    rubric: z.object({ criteria: z.array(Criterion).min(1).max(10) }),
    sponsorSignatures: z.array(SponsorSignature).default([]),
    /** Deterministic checks this event adds (names from lib/checks). */
    extraChecks: z.array(z.string()).default([]),
    /** A short note appended server-side to the judges' prompts. Our text, not the team's. */
    judgeContext: z.string().max(600).default(""),
  })
  .refine((e) => e.endsAt !== null || e.deadlineText !== null, { message: "an event needs endsAt or deadlineText" })
  .refine((e) => new Set(e.rubric.criteria.map((c) => c.key)).size === e.rubric.criteria.length, {
    message: "rubric keys must be unique",
  });

export type EventPreset = z.infer<typeof EventPreset>;
export type SponsorSignature = z.infer<typeof SponsorSignature>;
