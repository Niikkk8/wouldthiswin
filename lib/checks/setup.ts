// Check 4: can a judge run it? Env vars the code reads but .env.example doesn't list, a
// missing lockfile, no install or run steps in the README, README commands with no script.

import { copy, fill } from "../copy";
import type { Finding } from "../findings";
import type { RepoSnapshot } from "./types";

const ENV_READS = [
  /process\.env\.([A-Z][A-Z0-9_]{2,})/g,
  /process\.env\[["']([A-Z][A-Z0-9_]{2,})["']\]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]{2,})/g,
  /os\.environ(?:\.get)?\(\s*["']([A-Z][A-Z0-9_]{2,})["']/g,
  /os\.environ\[\s*["']([A-Z][A-Z0-9_]{2,})["']\s*\]/g,
  /os\.getenv\(\s*["']([A-Z][A-Z0-9_]{2,})["']/g,
];

/** Set by the platform or the toolchain, never by the person running it. */
const PLATFORM = /^(NODE_ENV|PORT|HOST|CI|VERCEL|VERCEL_.+|NEXT_RUNTIME|NEXT_PUBLIC_VERCEL_.+|HOME|PATH|PWD|DEV|PROD|MODE|SSR|BASE_URL)$/;
const CODE = /\.(m?[jt]sx?|py|svelte|vue)$/;
const LOCKFILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;
const INSTALL = /\b(npm (i|install|ci)|yarn( install)?|pnpm (i|install)|bun install|pip3? install|poetry install|uv (sync|pip install)|docker[- ]compose up|docker build|cargo (build|run)|go (build|run)|flutter (pub get|run))\b/i;
const RUN = /\b(npm (run )?(dev|start)|yarn (dev|start)|pnpm (dev|start)|bun (run )?(dev|start)|python3? \S+\.py|uvicorn|flask run|streamlit run|docker[- ]compose up|cargo run|go run|flutter run)\b/i;

const S = copy.checks.setup;

/** Env var names the code reads, with the first place each is read. */
export function envReads(files: ReadonlyMap<string, string>): Map<string, { path: string; line: number }> {
  const found = new Map<string, { path: string; line: number }>();
  for (const [path, text] of files) {
    if (!CODE.test(path)) continue;
    text.split(/\r?\n/).forEach((l, i) => {
      for (const re of ENV_READS) for (const m of l.matchAll(re)) if (!PLATFORM.test(m[1]) && !found.has(m[1])) found.set(m[1], { path, line: i + 1 });
    });
  }
  return found;
}

/** Keys a .env.example (or .env.sample / .env.template) declares. */
export function exampleKeys(files: ReadonlyMap<string, string>): { path: string; keys: Set<string> } | null {
  const path = [...files.keys()].find((p) => /(^|\/)\.env\.(example|sample|template)$/i.test(p));
  if (!path) return null;
  const keys = new Set([...files.get(path)!.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]));
  return { path, keys };
}

export function setupReproducibility(s: RepoSnapshot): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, "id" | "check" | "visibility" | "outcome">) =>
    out.push({ ...f, id: `setup-${out.length + 1}`, check: "setup", outcome: "warn", visibility: "public" });

  const reads = envReads(s.files);
  const example = exampleKeys(s.files);
  const undocumented = [...reads].filter(([k]) => !example?.keys.has(k));
  if (undocumented.length) {
    add({
      severity: "major",
      title: example ? fill(S.envMissing, { n: undocumented.length }) : S.noExample,
      detail: fill(S.envDetail, { names: undocumented.slice(0, 6).map(([k]) => k).join(", ") }),
      evidence: undocumented.slice(0, 4).map(([, at]) => ({ kind: "file" as const, path: at.path, startLine: at.line, endLine: at.line })),
      fix: example ? fill(S.envFix, { path: example.path }) : S.noExampleFix,
      effort: "5m",
    });
  }

  const pkg = s.tree.find((p) => p === "package.json");
  if (pkg && !s.tree.some((p) => LOCKFILES.test(p))) {
    add({ severity: "minor", title: S.noLockfile, detail: S.noLockfileDetail, evidence: [{ kind: "file", path: pkg }], fix: S.noLockfileFix, effort: "5m" });
  }

  const hasInstall = INSTALL.test(s.readme);
  const hasRun = RUN.test(s.readme);
  if (!hasInstall || !hasRun) {
    add({
      severity: "major",
      title: S.noSteps,
      detail: !hasInstall && !hasRun ? S.noStepsBoth : !hasInstall ? S.noStepsInstall : S.noStepsRun,
      evidence: [{ kind: "file", path: "README.md" }],
      fix: S.noStepsFix,
      effort: "5m",
    });
  }

  const pkgText = pkg ? s.files.get(pkg) : undefined;
  if (pkgText) {
    let scripts: Record<string, unknown> = {};
    try {
      scripts = (JSON.parse(pkgText) as { scripts?: Record<string, unknown> }).scripts ?? {};
    } catch {
      scripts = {};
    }
    const named = [...new Set([...s.readme.matchAll(/\b(?:npm run|yarn|pnpm( run)?|bun run)\s+([a-z][\w:-]*)/gi)].map((m) => m[2]))];
    const builtIn = new Set(["install", "i", "add", "ci", "init", "create", "dlx", "exec", "test", "start"]);
    const missing = named.filter((n) => !builtIn.has(n) && !(n in scripts));
    if (missing.length) {
      add({
        severity: "minor",
        title: fill(S.scriptMissing, { names: missing.slice(0, 3).join(", ") }),
        detail: S.scriptMissingDetail,
        evidence: [{ kind: "file", path: pkg! }, { kind: "file", path: "README.md" }],
        fix: S.scriptMissingFix,
        effort: "5m",
      });
    }
  }
  return out;
}
