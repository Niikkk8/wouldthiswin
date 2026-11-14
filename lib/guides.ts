// The guides: MDX files in content/guides, one per page at /guides/[slug]. Each file
// exports its own metadata:
//
//   export const meta = { title: "...", description: "...", date: "2026-11-07" };
//
// Server-only: it reads the folder at build time.

import fs from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";

export type GuideMeta = {
  title: string;
  description: string;
  /** Publish date, YYYY-MM-DD. */
  date: string;
  /** Last real edit, if any. YYYY-MM-DD. */
  updated?: string;
  /** Hidden from the index, the sitemap and search until it's flipped to false. */
  draft?: boolean;
  /** Slugs of guides to read next: at least two. */
  related?: string[];
};

type Env = Record<string, string | undefined>;

/** A draft exists only outside production, so it can be read and edited before it's published. */
export const visible = (g: Pick<GuideMeta, "draft">, env: Env = process.env) => !g.draft || env.NODE_ENV !== "production";

export type Guide = GuideMeta & { slug: string };

const DIR = path.join(process.cwd(), "content/guides");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function guideSlugs(): string[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.slice(0, -4))
    .filter((s) => SLUG_RE.test(s));
}

/** One guide's body and metadata. Null for a slug with no file. */
export async function loadGuide(slug: string): Promise<{ meta: Guide; Body: ComponentType } | null> {
  if (!guideSlugs().includes(slug)) return null;
  const mod = (await import(`@/content/guides/${slug}.mdx`)) as { default: ComponentType; meta: GuideMeta };
  return { meta: { ...mod.meta, slug }, Body: mod.default };
}

/** Every published guide, newest first. Drafts never appear in lists, the sitemap or llms.txt. */
export async function allGuides(): Promise<Guide[]> {
  const guides = await Promise.all(guideSlugs().map(async (s) => (await loadGuide(s))!.meta));
  return guides.filter((g) => !g.draft).sort((a, b) => b.date.localeCompare(a.date));
}

/** The guides a guide links to next, in its own order, skipping drafts in production and missing slugs. */
export async function relatedGuides(meta: Guide): Promise<Guide[]> {
  const found = await Promise.all((meta.related ?? []).map(async (s) => (await loadGuide(s))?.meta ?? null));
  return found.filter((g): g is Guide => !!g && visible(g));
}

export const guidePath = (slug: string) => `/guides/${slug}`;

/** "7 November 2026". */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
