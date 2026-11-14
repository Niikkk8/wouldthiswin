// Honest pitch tools: a README skeleton and a submission draft built only from what the code
// backs. Supported claims go in; everything else is listed as left out until the code backs
// it. Pure templates, no model: nothing here can say more than the scan found.

import { copy, fill } from "./copy";
import type { RawRepoData } from "./github";
import type { Claim } from "./session";
import { detectStack } from "./signals";

export type PitchFacts = { stack: string[]; setup: string[] };

const LOCKS: [RegExp, string][] = [
  [/(^|\/)pnpm-lock\.yaml$/, "pnpm"],
  [/(^|\/)yarn\.lock$/, "yarn"],
  [/(^|\/)bun\.lockb?$/, "bun"],
];

/** The setup steps the repo itself supports: the right package manager and scripts that exist. */
export function setupSteps(
  raw: Pick<RawRepoData, "ref" | "packageJson" | "requirementsTxt" | "headFilePaths">,
): string[] {
  const steps = [
    `git clone https://github.com/${raw.ref.owner}/${raw.ref.repo} && cd ${raw.ref.repo}`,
  ];
  if (raw.headFilePaths.some((p) => /(^|\/)\.env\.(example|sample|template)$/.test(p)))
    steps.push("cp .env.example .env  # then fill in the values");
  if (raw.packageJson) {
    const pm = LOCKS.find(([re]) => raw.headFilePaths.some((p) => re.test(p)))?.[1] ?? "npm";
    let scripts: Record<string, unknown> = {};
    try {
      scripts =
        (JSON.parse(raw.packageJson) as { scripts?: Record<string, unknown> }).scripts ?? {};
    } catch {
      scripts = {};
    }
    steps.push(`${pm} install`);
    const run = ["dev", "start"].find((s) => s in scripts);
    if (run) steps.push(pm === "npm" ? `npm run ${run}` : `${pm} ${run}`);
  } else if (raw.requirementsTxt) {
    steps.push("pip install -r requirements.txt");
  }
  return steps;
}

export function pitchFacts(
  raw: Parameters<typeof detectStack>[0] & Parameters<typeof setupSteps>[0],
): PitchFacts {
  return { stack: detectStack(raw).slice(0, 10), setup: setupSteps(raw) };
}

const supported = (c: Claim) => c.verdict === "supported" || (!c.verdict && c.status === "backed");
const projectName = (repo: string) => repo.split("/").pop() ?? repo;

export type Pitch = { readme: string; submission: string; leftOut: string[]; words: number };

const P = copy.pitch;
const MAX_WORDS = 250;

function capWords(text: string, max: number): string {
  const words = text.split(/\s+/);
  if (words.length <= max) return text;
  const cut = words.slice(0, max).join(" ");
  const end = cut.lastIndexOf(".");
  return end > cut.length * 0.6 ? cut.slice(0, end + 1) : `${cut}.`;
}

export function buildPitch(input: {
  repo: string;
  oneLiner: string;
  claims: readonly Claim[];
  facts: PitchFacts | null;
}): Pitch {
  const name = projectName(input.repo);
  const backed = input.claims.filter(supported);
  const leftOut = input.claims.filter((c) => !supported(c)).map((c) => c.claim);
  const stack = input.facts?.stack ?? [];
  const setup = input.facts?.setup ?? [];
  const where = (c: Claim) =>
    c.citations?.[0] ? ` (\`${c.citations[0].path}\`)` : c.file ? ` (\`${c.file}\`)` : "";

  const readme = [
    `# ${name}`,
    "",
    fill(P.readme.oneLiner, { oneLiner: input.oneLiner }),
    "",
    `## ${P.readme.what}`,
    "",
    ...(backed.length ? backed.map((c) => `- ${c.claim}${where(c)}`) : [P.readme.nothingBacked]),
    "",
    ...(stack.length ? [`## ${P.readme.stack}`, "", ...stack.map((s) => `- ${s}`), ""] : []),
    ...(setup.length ? [`## ${P.readme.setup}`, "", "```bash", ...setup, "```", ""] : []),
    `## ${P.readme.team}`,
    "",
    P.readme.teamNote,
    "",
  ].join("\n");

  const paragraphs = [
    fill(P.submission.intro, { name, oneLiner: input.oneLiner }),
    backed.length
      ? fill(P.submission.works, {
          list: backed.map((c) => c.claim.charAt(0).toLowerCase() + c.claim.slice(1)).join("; "),
        })
      : P.submission.noWorks,
    stack.length ? fill(P.submission.stack, { stack: stack.join(", ") }) : "",
    leftOut.length
      ? fill(P.submission.next, {
          list: leftOut
            .slice(0, 4)
            .map((c) => c.charAt(0).toLowerCase() + c.slice(1))
            .join("; "),
        })
      : "",
    fill(P.submission.repo, { url: `https://github.com/${input.repo}` }),
  ].filter(Boolean);
  const submission = capWords(paragraphs.join("\n\n"), MAX_WORDS);
  return { readme, submission, leftOut, words: submission.split(/\s+/).filter(Boolean).length };
}
