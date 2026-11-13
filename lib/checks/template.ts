// Check 3: starter-template leftovers. Judges spot a "Create Next App" tab title or an
// untouched starter page in seconds, and read it as "nobody finished this".

import { copy, fill } from "../copy";
import type { Finding } from "../findings";
import type { RepoSnapshot } from "./types";

export const TEMPLATE_README =
  /bootstrapped with [[`]*create-next-app|bootstrapped with [[`]*create[- ]react[- ]app|this template provides a minimal setup to get react working in vite|^# react \+ (typescript \+ )?vite|^# vue 3 \+ (typescript \+ )?vite|everything you need to build a svelte project|welcome to your expo app|# astro starter kit|getting started with create react app/im;

/** Default titles, as they appear in each starter's source. */
const TITLES: [RegExp, string][] = [
  [/title:\s*["'`]Create Next App["'`]/, "Create Next App"],
  [/<title>\s*Vite \+ (React|Vue|Svelte|Preact|Lit)( \+ TS)?\s*<\/title>/i, "Vite starter"],
  [/<title>\s*React App\s*<\/title>/i, "React App"],
  [/<title>\s*Vite App\s*<\/title>/i, "Vite App"],
];

/** Lines only an untouched starter page has. */
const STARTER_PAGES: [RegExp, string][] = [
  [/Get started by editing|To get started, edit the page\.(tsx|js) file/, "create-next-app"],
  [/Edit <code>src\/App\.(tsx|jsx)<\/code> and save to test HMR|count is \{count\}/, "Vite"],
  [/Edit <code>src\/App\.js<\/code> and save to reload/, "Create React App"],
];

/** The starter's own public assets, still in the repo. */
const STARTER_ASSETS = /^(public\/(next|vercel|vite|file|globe|window)\.svg|src\/assets\/react\.svg|src\/logo\.svg)$/;

const T = copy.checks.template;

export function templateLeftovers(s: RepoSnapshot): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, "id" | "check" | "visibility">) => out.push({ ...f, id: `template-${out.length + 1}`, check: "template", visibility: "public" });

  if (TEMPLATE_README.test(s.readme)) {
    add({ outcome: "fail", severity: "major", title: T.readme, detail: T.readmeDetail, evidence: [{ kind: "file", path: "README.md" }], fix: T.readmeFix, effort: "30m" });
  }
  for (const [path, text] of s.files) {
    const lines = text.split(/\r?\n/);
    for (const [re, name] of TITLES) {
      const i = lines.findIndex((l) => re.test(l));
      if (i >= 0) {
        add({
          outcome: "fail",
          severity: "major",
          title: fill(T.title, { name }),
          detail: fill(T.titleDetail, { name }),
          evidence: [{ kind: "file", path, startLine: i + 1, endLine: i + 1 }],
          fix: T.titleFix,
          effort: "5m",
        });
      }
    }
    for (const [re, name] of STARTER_PAGES) {
      const i = lines.findIndex((l) => re.test(l));
      if (i >= 0) {
        add({
          outcome: "fail",
          severity: "minor",
          title: fill(T.page, { name }),
          detail: T.pageDetail,
          evidence: [{ kind: "file", path, startLine: i + 1, endLine: i + 1 }],
          fix: T.pageFix,
          effort: "30m",
        });
      }
    }
  }
  const assets = s.tree.filter((p) => STARTER_ASSETS.test(p));
  if (assets.length >= 2) {
    add({
      outcome: "warn",
      severity: "minor",
      title: T.assets,
      detail: fill(T.assetsDetail, { n: assets.length }),
      evidence: assets.slice(0, 5).map((path) => ({ kind: "file" as const, path })),
      fix: T.assetsFix,
      effort: "5m",
    });
  }
  return out;
}
