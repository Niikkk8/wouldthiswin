// Checks a demo link over the network. Every request goes through checkDemo, so the SSRF
// protections (blocked addresses after DNS, redirect re-validation, timeouts) apply to all.

import { checkDemo } from "./demo-check";
import type { DemoLink } from "./demo-link";
import type { DemoStatus } from "./odds";

// A deleted or private video's page often still answers 200, so videos are checked through
// the host's oEmbed endpoint, which 404s (or 401s) when there's no public video.
const OEMBED: Record<"youtube" | "vimeo" | "loom", (url: string) => string> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  vimeo: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  loom: (u) => `https://www.loom.com/v1/oembed?url=${encodeURIComponent(u)}`,
};

type Check = typeof checkDemo;

/** loads: a live site answers. video: the video exists and is public. dead: neither. */
export async function checkDemoLink(
  link: DemoLink | null,
  check: Check = checkDemo,
): Promise<DemoStatus> {
  if (!link) return "none";
  if (link.kind === "site") return (await check(link.url)).loads ? "loads" : "dead";
  if (link.provider === "drive") {
    // Drive has no oEmbed. A private file redirects to the Google sign-in page.
    const r = await check(link.url);
    const host = r.finalUrl ? new URL(r.finalUrl).hostname : "";
    return r.loads && host === "drive.google.com" ? "video" : "dead";
  }
  return (await check(OEMBED[link.provider](link.url))).loads ? "video" : "dead";
}
