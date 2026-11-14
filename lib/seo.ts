// Page metadata in one shape for every indexable route: a unique title of at most 60
// characters, a description of at most 155, a canonical URL, and Open Graph and Twitter tags.

import type { Metadata } from "next";
import { copy } from "./copy";
import { SITE_URL } from "./site";

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;

/** Cuts at a word boundary and adds an ellipsis when it has to. */
export function fit(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:\s]+$/, "")}…`;
}

export function pageMeta(p: { title: string; description: string; path: string; index?: boolean; type?: "website" | "article" }): Metadata {
  const title = fit(p.title, MAX_TITLE);
  const description = fit(p.description, MAX_DESCRIPTION);
  const url = `${SITE_URL}${p.path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: p.index === false ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title, description, url, siteName: copy.meta.name, type: p.type ?? "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}
