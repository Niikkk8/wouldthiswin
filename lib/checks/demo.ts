// F13: the live demo check. Finds demo URLs in the README, the Devpost page and the repo's
// website field, opens each through the SSRF-safe fetcher (GET, 5s, 3 redirects, 512 KB) and
// reports what a judge clicking it would see. Classification is pure; the fetch is injected.

import { copy, fill } from "../copy";
import type { Page } from "../demo-check";
import type { Finding } from "../findings";

const MAX_DEMOS = 3;
const HOSTED =
  /\b(vercel\.app|netlify\.app|github\.io|pages\.dev|onrender\.com|railway\.app|fly\.dev|herokuapp\.com|streamlit\.app|huggingface\.co\/spaces|replit\.app|web\.app|firebaseapp\.com|surge\.sh|glitch\.me)\b/i;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i;
const NOT_FOUND_PAGES = [
  /DEPLOYMENT_NOT_FOUND|The deployment could not be found on Vercel/i,
  /Looks like you(?:'|&#x27;|&#39;)ve followed a broken link or entered a URL that doesn(?:'|&#x27;|&#39;)t exist on this site/i,
  /There isn(?:'|&#x27;|&#39;)t a GitHub Pages site here/i,
  /This Streamlit app is (?:asleep|offline)|Zzzz/i,
  /Application not found|no such app/i,
];
export const DEFAULT_TITLES =
  /^(create next app|next\.js|vite \+ react( \+ ts)?|vite \+ vue( \+ ts)?|vite app|react app|svelte app|sveltekit|nuxt|astro|streamlit|gradio|expo|document|untitled|home|my app|app)$/i;

/** Links that look like a demo: hosted apps, anything labelled demo or live, the website field. */
export function demoCandidates(input: {
  readme: string;
  homepage: string | null;
  devpostLinks: readonly string[];
}): string[] {
  const urls: string[] = [];
  const md = input.readme;
  for (const m of md.matchAll(/https?:\/\/[^\s)"'<>\]]+/g)) {
    const url = m[0].replace(/[).,;]+$/, "");
    const around = md.slice(Math.max(0, m.index - 60), m.index).toLowerCase();
    if (
      HOSTED.test(url) ||
      LOCAL.test(url) ||
      /\b(demo|live|deployed|try it|website|app)\b/.test(around)
    )
      urls.push(url);
  }
  if (input.homepage)
    urls.unshift(
      /^https?:\/\//i.test(input.homepage) ? input.homepage : `https://${input.homepage}`,
    );
  for (const l of input.devpostLinks) if (!/github\.com|devpost\.com/i.test(l)) urls.push(l);
  return [...new Set(urls)]
    .filter(
      (u) => !/github\.com|shields\.io|badge|youtube\.com|youtu\.be|loom\.com|vimeo\.com/i.test(u),
    )
    .slice(0, MAX_DEMOS);
}

const titleOf = (html: string) =>
  html
    .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    .replace(/\s+/g, " ")
    .trim() ?? null;
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );

const D = copy.checks.demo;

/** What a judge would see at each demo link. One finding per problem. */
export function demoFindings(
  results: readonly { url: string; page: Page | null }[],
  projectName: string,
): Finding[] {
  const out: Finding[] = [];
  const add = (url: string, f: Omit<Finding, "id" | "check" | "visibility" | "evidence">) =>
    out.push({
      ...f,
      id: `demo-check-${out.length + 1}`,
      check: "demo",
      visibility: "public",
      evidence: [{ kind: "url", url }],
    });
  for (const { url, page } of results) {
    if (LOCAL.test(url)) {
      add(url, {
        outcome: "fail",
        severity: "major",
        title: D.localhost,
        detail: fill(D.localhostDetail, { url }),
        fix: D.localhostFix,
        effort: "30m",
      });
      continue;
    }
    if (!page || page.status === null) {
      add(url, {
        outcome: "fail",
        severity: "blocker",
        title: D.unreachable,
        detail: fill(D.unreachableDetail, { url, reason: page?.reason ?? "network" }),
        fix: D.fix,
        effort: "30m",
      });
      continue;
    }
    if (NOT_FOUND_PAGES.some((re) => re.test(page.body))) {
      add(url, {
        outcome: "fail",
        severity: "blocker",
        title: D.notFound,
        detail: fill(D.notFoundDetail, { url }),
        fix: D.fix,
        effort: "30m",
      });
      continue;
    }
    if (!page.ok) {
      add(url, {
        outcome: "fail",
        severity: "blocker",
        title: fill(D.status, { status: page.status }),
        detail: fill(D.statusDetail, { url, status: page.status }),
        fix: D.fix,
        effort: "30m",
      });
      continue;
    }
    const title = titleOf(page.body);
    if (title && DEFAULT_TITLES.test(title)) {
      add(url, {
        outcome: "fail",
        severity: "major",
        title: fill(D.defaultTitle, { title }),
        detail: D.defaultTitleDetail,
        fix: D.titleFix,
        effort: "5m",
      });
    } else if (title && projectName && ![...words(projectName)].some((w) => words(title).has(w))) {
      add(url, {
        outcome: "warn",
        severity: "minor",
        title: D.titleMismatch,
        detail: fill(D.titleMismatchDetail, { title, name: projectName }),
        fix: D.titleFix,
        effort: "5m",
      });
    }
  }
  return out;
}

export async function checkDemos(
  urls: readonly string[],
  fetch: (url: string) => Promise<Page>,
  projectName: string,
): Promise<Finding[]> {
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      page: LOCAL.test(url) ? null : await fetch(url).catch(() => null),
    })),
  );
  return demoFindings(results, projectName);
}
