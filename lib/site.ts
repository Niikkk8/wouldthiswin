// Public URLs for a session's review: the link, the share card, the badge, the X post.

import { copy, fill } from "./copy";
import type { Review } from "./review";

/** The canonical site. Copyable links always use it, even when the page runs elsewhere. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://wouldthiswin.com").replace(/\/+$/, "");

export const reviewPath = (id: string) => `/s/${id}`;
export const ogPath = (id: string) => `/og/${id}`;
export const badgePath = (id: string) => `/badge/${id}.svg`;

export const reviewUrl = (id: string) => SITE_URL + reviewPath(id);
export const badgeUrl = (id: string) => SITE_URL + badgePath(id);

export function badgeMarkdown(id: string): string {
  return `[![Would this win](${badgeUrl(id)})](${reviewUrl(id)})`;
}

const projectName = (repo: string) => repo.split("/").pop() ?? repo;

/** X's post intent, prefilled with the one-liner and the odds. */
export function postToXUrl(r: Pick<Review, "id" | "repo" | "oneLiner" | "odds">): string {
  const text = fill(copy.acts.share.postText, {
    repo: projectName(r.repo),
    oneLiner: r.oneLiner,
    odds: r.odds,
  });
  const q = new URLSearchParams({ text, url: reviewUrl(r.id) });
  return `https://x.com/intent/post?${q.toString()}`;
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
