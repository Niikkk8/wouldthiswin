// Check 5: the README essentials judges look for, as a checklist: what it is in one line near
// the top, a demo link, a screenshot or GIF, how it works, the stack, the team, setup steps.

import { copy, fill } from "../copy";
import type { Finding } from "../findings";
import { readmeHasImages, readmeHasVideo } from "../signals";
import type { RepoSnapshot } from "./types";

export const README_ITEMS = ["oneLiner", "demo", "visual", "howItWorks", "stack", "team", "setup"] as const;
export type ReadmeItem = (typeof README_ITEMS)[number];

const LIVE = /https?:\/\/[^\s)"'<>]*\b(vercel\.app|netlify\.app|github\.io|pages\.dev|onrender\.com|railway\.app|fly\.dev|herokuapp\.com|streamlit\.app|huggingface\.co\/spaces|replit\.app|web\.app|firebaseapp\.com)/i;
const heading = (re: RegExp) => (md: string) => md.split(/\r?\n/).some((l) => /^#{1,4}\s/.test(l) && re.test(l.replace(/^#+\s*/, "")));

/** The first prose line after the title, within the first 15 lines: is it one plain sentence of what this is? */
function oneLiner(md: string): boolean {
  const lines = md.split(/\r?\n/).slice(0, 15).map((l) => l.trim());
  const prose = lines.find((l) => l && !/^(#|!\[|<|\[!\[|```|---|\||[-*]\s)/.test(l));
  return !!prose && prose.length >= 20 && prose.length <= 300 && !/^(npm|pip|git|cd |yarn|pnpm)/.test(prose);
}

const CHECKS: Record<ReadmeItem, (md: string) => boolean> = {
  oneLiner,
  demo: (md) => LIVE.test(md) || readmeHasVideo(md) || /\b(live demo|demo:|try it)\b.*https?:\/\//i.test(md),
  visual: readmeHasImages,
  howItWorks: heading(/how (it|this) works|architecture|how we built|under the hood|system design/i),
  stack: heading(/tech(nology)? stack|built with|stack|technologies|tools used/i),
  team: heading(/team|contributors|authors|built by|who we are|members/i),
  setup: heading(/getting started|installation|install|setup|set up|run(ning)? locally|quick ?start|usage|how to run/i),
};

/** Which essentials the README has. Pure, shared with the README guide and the pitch tools. */
export function readmeChecklist(md: string): Record<ReadmeItem, boolean> {
  return Object.fromEntries(README_ITEMS.map((k) => [k, CHECKS[k](md)])) as Record<ReadmeItem, boolean>;
}

const R = copy.checks.readme;

export function readmeEssentials(s: RepoSnapshot): Finding[] {
  const list = readmeChecklist(s.readme);
  const missing = README_ITEMS.filter((k) => !list[k]);
  const have = README_ITEMS.length - missing.length;
  return [
    {
      id: "readme",
      check: "readme",
      outcome: missing.length === 0 ? "pass" : missing.length <= 2 ? "warn" : "fail",
      severity: missing.length === 0 ? null : missing.length <= 2 ? "minor" : "major",
      title: fill(R.title, { have, total: README_ITEMS.length }),
      detail: missing.length ? fill(R.missing, { items: missing.map((k) => R.items[k]).join(", ") }) : R.complete,
      evidence: [{ kind: "file", path: "README.md" }],
      fix: missing.length ? fill(R.fix, { items: missing.map((k) => R.items[k]).join(", ") }) : null,
      effort: missing.length ? (missing.length > 3 ? "2h" : "30m") : null,
      visibility: "public",
    },
  ];
}
