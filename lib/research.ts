// F27: the State of Hackathon Repos numbers. Each repo is reduced in memory to which kinds of
// problem it had (never a title, a path, a URL or a secret), and only counts across all repos
// leave the script. Cells smaller than MIN_CELL are dropped so no count points at one repo.

import { AI_LEVELS, type AiLevel } from "./checks/ai-depth";
import { copy } from "./copy";
import type { Finding } from "./findings";

export const MIN_CELL = 3;

const C = copy.checks;

/** Every problem kind the report counts, with the copy line that titles its finding. */
const KINDS = [
  ["secrets.key", C.secrets.title],
  ["secrets.env", C.secrets.envTitle],
  ["secrets.history", C.secrets.historyTitle],
  ["template.readme", C.template.readme],
  ["template.title", C.template.title],
  ["template.page", C.template.page],
  ["template.assets", C.template.assets],
  ["setup.envMissing", C.setup.envMissing],
  ["setup.noExample", C.setup.noExample],
  ["setup.noLockfile", C.setup.noLockfile],
  ["setup.noSteps", C.setup.noSteps],
  ["setup.scriptMissing", C.setup.scriptMissing],
  ["readme.incomplete", C.readme.title],
  ["hygiene.noTests", C.hygiene.noTests],
  ["hygiene.noCi", C.hygiene.noCi],
  ["hygiene.noLicense", C.hygiene.noLicense],
  ["hygiene.bigFiles", C.hygiene.bigFiles],
  ["hygiene.committed", C.hygiene.committed],
  ["demo.localhost", C.demo.localhost],
  ["demo.unreachable", C.demo.unreachable],
  ["demo.notFound", C.demo.notFound],
  ["demo.status", C.demo.status],
  ["demo.defaultTitle", C.demo.defaultTitle],
  ["demo.titleMismatch", C.demo.titleMismatch],
] as const;

export type ProblemKind = (typeof KINDS)[number][0];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = KINDS.map(
  ([kind, template]) =>
    [
      kind,
      new RegExp(
        `^${template
          .split(/\{\w+\}/)
          .map(escape)
          .join("[\\s\\S]*")}$`,
      ),
    ] as const,
);

/** The kind of a problem finding, from its title's shape. Passes and unknown titles have none. */
export function problemKind(f: Pick<Finding, "outcome" | "title">): ProblemKind | null {
  if (f.outcome === "pass") return null;
  return MATCHERS.find(([, re]) => re.test(f.title))?.[0] ?? null;
}

/** All one repo leaves behind: the kinds it hit, its AI depth, whether it links a demo. */
export type RepoSummary = { kinds: ProblemKind[]; ai: AiLevel; demo: boolean };

export function summarize(findings: readonly Finding[], ai: AiLevel, demo: boolean): RepoSummary {
  const kinds = new Set(findings.map(problemKind).filter((k): k is ProblemKind => k !== null));
  return { kinds: [...kinds], ai, demo };
}

export type ResearchAggregate = {
  version: 1;
  generatedAt: string;
  scanned: number;
  failed: number;
  minCell: number;
  /** Repos with none of the counted problems. */
  clean: number;
  withDemo: number;
  /** Most common first; kinds seen in fewer than minCell repos are left out. */
  kinds: { kind: ProblemKind; repos: number }[];
  /** Levels seen in fewer than minCell repos are left out. */
  aiLevels: { level: AiLevel; repos: number }[];
};

const keep = (n: number) => n >= MIN_CELL;

export function aggregate(
  repos: readonly RepoSummary[],
  failed: number,
  now: Date = new Date(),
): ResearchAggregate {
  const kinds = new Map<ProblemKind, number>();
  for (const r of repos) for (const k of r.kinds) kinds.set(k, (kinds.get(k) ?? 0) + 1);
  return {
    version: 1,
    generatedAt: now.toISOString(),
    scanned: repos.length,
    failed,
    minCell: MIN_CELL,
    clean: repos.filter((r) => r.kinds.length === 0).length,
    withDemo: repos.filter((r) => r.demo).length,
    kinds: [...kinds]
      .filter(([, n]) => keep(n))
      .map(([kind, n]) => ({ kind, repos: n }))
      .sort((a, b) => b.repos - a.repos || a.kind.localeCompare(b.kind)),
    aiLevels: AI_LEVELS.map((level) => ({
      level,
      repos: repos.filter((r) => r.ai === level).length,
    })).filter((l) => keep(l.repos)),
  };
}

/** GitHub repo URLs from a CSV: any cell that is one, deduplicated, in order. */
export function repoUrlsFromCsv(csv: string): string[] {
  const urls = csv.match(/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/gi) ?? [];
  return [...new Set(urls.map((u) => u.replace(/\.git$/i, "").toLowerCase()))];
}
