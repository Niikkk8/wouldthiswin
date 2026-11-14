// Gathers the snapshot the checks read: which files to fetch (picked here, purely), their
// text, and the history of env files. The file text lives only in memory for the checks.

import { isReadablePath } from "../sources";
import { ENV_FILE, ENV_TEMPLATE } from "./secrets";
import type { RepoSnapshot } from "./types";

export const MAX_CHECK_FILES = 40;
const MAX_SIZE = 300 * 1024;

/** Files every starter or setup check looks at first, wherever they are. */
const FIRST =
  /(^|\/)(package\.json|index\.html|requirements\.txt|pyproject\.toml|(app|src\/app)\/(layout|page)\.[jt]sx?|src\/(App|main)\.[jt]sx?|pages\/(index|_app|_document)\.[jt]sx?|(next|vite|nuxt|svelte)\.config\.[cm]?[jt]s)$/;
const CODE =
  /\.(m?[jt]sx?|py|svelte|vue|go|rb|php|java|kt|swift|rs|dart|ya?ml|toml|json|ini|cfg|conf|properties)$/i;

/** Env files and templates first, then the usual suspects, then code, shallowest first. */
export function pickCheckFiles(
  tree: readonly string[],
  sizes: Readonly<Record<string, number>>,
  limit = MAX_CHECK_FILES,
): string[] {
  const fits = (p: string) => (sizes[p] ?? 0) <= MAX_SIZE;
  const env = tree.filter((p) => (ENV_FILE.test(p) || ENV_TEMPLATE.test(p)) && fits(p));
  const first = tree.filter((p) => FIRST.test(p) && isReadablePath(p) && fits(p));
  const code = tree
    .filter((p) => CODE.test(p) && isReadablePath(p) && fits(p))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  return [...new Set([...env, ...first, ...code])].slice(0, limit);
}

/** Env files to look up in history: the ones in the tree, and the usual ones that may be deleted. */
export function envPathsToTrace(tree: readonly string[]): string[] {
  return [
    ...new Set([
      ".env",
      ".env.local",
      ".env.production",
      ...tree.filter((p) => ENV_FILE.test(p) && !ENV_TEMPLATE.test(p)),
    ]),
  ].slice(0, 6);
}

export async function collectSnapshot(
  input: {
    repo: string;
    tree: readonly string[];
    sizes: Readonly<Record<string, number>>;
    readme: string;
  },
  deps: {
    read: (path: string) => Promise<string | null>;
    commits: (path: string) => Promise<string[]>;
  },
): Promise<RepoSnapshot> {
  const paths = pickCheckFiles(input.tree, input.sizes);
  const [texts, history] = await Promise.all([
    Promise.all(paths.map(async (p) => [p, await deps.read(p)] as const)),
    Promise.all(envPathsToTrace(input.tree).map(async (p) => [p, await deps.commits(p)] as const)),
  ]);
  return {
    repo: input.repo,
    tree: input.tree,
    sizes: input.sizes,
    files: new Map(texts.filter((t): t is readonly [string, string] => t[1] !== null)),
    readme: input.readme,
    envHistory: Object.fromEntries(history),
  };
}
