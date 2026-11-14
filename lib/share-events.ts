// What the share screen logs, for the stats: one row per action, no user data.
// Client-safe: the route validates with the same schema the client sends.

import { z } from "zod";

export const SHARE_KINDS = [
  "share_image",
  "x_clicked",
  "linkedin_clicked",
  "download",
  "caption_copied",
] as const;

/** Mirrors POST_FORMATS in the share card; kept here so the route doesn't import a component. */
export const SHARE_EVENT_FORMATS = ["landscape", "portrait", "story"] as const;

export const ShareEvent = z
  .object({
    kind: z.enum(SHARE_KINDS),
    format: z.enum(SHARE_EVENT_FORMATS).optional(),
  })
  .strict()
  .refine((e) => e.kind !== "download" || e.format, { message: "a download needs its format" });
export type ShareEvent = z.infer<typeof ShareEvent>;

/** More than this per review is someone clicking for the sake of it; the rest aren't stored. */
export const MAX_EVENTS_PER_REVIEW = 200;

/** Fire and forget: never blocks the click, survives the page navigating away. */
export function logShare(id: string, e: ShareEvent): void {
  try {
    void fetch(`/api/sessions/${id}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(e),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Logging must never break sharing.
  }
}
