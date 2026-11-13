// Public URLs for a session's review: the link, the share card, the badge, the X post.

import { copy, fill } from "./copy";
import type { Review } from "./review";

/** The canonical site. Copyable links always use it, even when the page runs elsewhere. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://wouldthiswin.com").replace(/\/+$/, "");

/** The session itself: the owner resumes here; anyone else is sent to the shared verdict. */
export const reviewPath = (id: string) => `/s/${id}`;
/** The shareable verdict, once its owner has opted in. */
export const verdictPath = (id: string) => `/v/${id}`;
export const ogPath = (id: string) => `/og/${id}`;
export const badgePath = (id: string) => `/badge/${id}.svg`;
/** The repo's badge: its latest shareable verdict, or "not judged yet". */
export const repoBadgePath = (repo: string) => `/api/badge/${repo}`;

export const reviewUrl = (id: string) => SITE_URL + verdictPath(id);
export const badgeUrl = (id: string) => SITE_URL + badgePath(id);

export function badgeMarkdown(id: string): string {
  return `[![Would this win](${badgeUrl(id)})](${reviewUrl(id)})`;
}

/** The badge that always shows the repo's latest shareable verdict. */
export function repoBadgeMarkdown(repo: string, id: string): string {
  return `[![Would this win](${SITE_URL + repoBadgePath(repo)})](${reviewUrl(id)})`;
}

const projectName = (repo: string) => repo.split("/").pop() ?? repo;

/** "the judges gave queueless a 37% chance. Changes requested." */
export function shareText(r: Pick<Review, "repo" | "odds" | "readyToWin">): string {
  return fill(copy.acts.share.postText, {
    repo: projectName(r.repo),
    odds: r.odds,
    status: r.readyToWin ? copy.review.ready : copy.review.changes,
  });
}

/** X's post intent: the share text and the verdict link. */
export function postToXUrl(r: Pick<Review, "id" | "repo" | "odds" | "readyToWin">): string {
  const q = new URLSearchParams({ text: shareText(r), url: reviewUrl(r.id) });
  return `https://x.com/intent/post?${q.toString()}`;
}

/** WhatsApp's share link: the text with the verdict link after it. */
export function whatsAppUrl(r: Pick<Review, "id" | "repo" | "odds" | "readyToWin">): string {
  return `https://wa.me/?${new URLSearchParams({ text: `${shareText(r)} ${reviewUrl(r.id)}` }).toString()}`;
}

/** A share image in one of the post formats. */
export const imagePath = (id: string, format: "landscape" | "portrait" | "story") => `/og/${id}/${format}.png`;
export const imageFileName = (r: Pick<Review, "repo">, format: string) =>
  `wouldthiswin-${projectName(r.repo).replace(/[^\w.-]+/g, "-")}-${format}.png`;

/** LinkedIn's share link: it reads the review page's own preview. */
export function linkedInUrl(id: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: reviewUrl(id) }).toString()}`;
}

/** The caption that goes with a shared image: the odds, the one-liner and the link. */
export function captionFor(r: Pick<Review, "id" | "repo" | "oneLiner" | "odds">): string {
  return fill(copy.acts.share.caption, { repo: projectName(r.repo), oneLiner: r.oneLiner, odds: r.odds, url: reviewUrl(r.id) });
}
