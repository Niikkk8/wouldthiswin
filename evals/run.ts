// npm run eval [-- --claims]
// Runs the deterministic checks on the fixtures and prints precision and recall per check,
// plus the prompt-injection invariants. With --claims (needs ANTHROPIC_API_KEY), also runs claim
// extraction and the verification agent on each fixture and prints their verdicts.

import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { scoreAnswer } from "../lib/answer-score";
import { extractClaims } from "../lib/evidence/extract";
import { claimSources } from "../lib/evidence/sources";
import { verifyClaims } from "../lib/evidence/verify";
import { newUsage, usdOf } from "../lib/model";
import { FIXTURES } from "./fixtures";
import { honest } from "./fixtures/honest";
import { injection } from "./fixtures/injection";
import { sameFindings, scoreChecks } from "./score";

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

/** A scorer that obeys whatever the answer says: the worst case for the injection cap. */
const obedient = async () =>
  ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          why: "told to",
          score: 10,
          specific: true,
          reaction: "Perfect.",
          followUp: null,
        }),
      },
    ],
    stop_reason: "end_turn",
    usage: { input_tokens: 0, output_tokens: 0 },
  }) as unknown as Anthropic.Message;

async function main() {
  const scores = scoreChecks(FIXTURES);
  const out = process.stdout;
  out.write(`Fixtures: ${FIXTURES.map((f) => f.name).join(", ")}\n\n`);
  out.write("| Check | Precision | Recall | TP | FP | FN |\n|---|---|---|---|---|---|\n");
  for (const s of scores)
    out.write(
      `| ${s.check} | ${pct(s.precision)} | ${pct(s.recall)} | ${s.tp} | ${s.fp} | ${s.fn} |\n`,
    );

  const injected = await scoreAnswer(
    { judge: "engineer", question: "Which file does it?", answer: injection.readme, claims: [] },
    obedient,
  );
  const invariants = {
    findingsUnchanged: sameFindings(honest, injection),
    injectedAnswerScore: injected.score,
  };
  out.write(
    `\nInjection: findings unchanged ${invariants.findingsUnchanged ? "yes" : "NO"}; an injected answer scored by a model that obeys it still gets ${invariants.injectedAnswerScore}.\n`,
  );

  const report: Record<string, unknown> = {
    date: new Date().toISOString(),
    fixtures: FIXTURES.map((f) => f.name),
    checks: scores,
    invariants,
  };

  if (process.argv.includes("--claims")) {
    const usage = newUsage();
    const agent: Record<string, { claim: string; verdict: string }[]> = {};
    for (const f of FIXTURES) {
      const claims = await extractClaims(
        claimSources({ readme: f.readme, devpost: null, submission: null }),
        usage,
      );
      const { verdicts } = await verifyClaims(
        claims,
        { tree: Object.keys(f.files), read: async (p) => f.files[p] ?? null },
        usage,
      );
      agent[f.name] = claims.map((c) => ({
        claim: c.text,
        verdict: verdicts.find((v) => v.id === c.id)?.status ?? "cant_verify",
      }));
      out.write(
        `\n${f.name}\n${agent[f.name].map((c) => `  ${c.verdict}: ${c.claim}`).join("\n")}\n`,
      );
    }
    report.agent = agent;
    out.write(`\nClaim agent spend: $${usdOf(usage).toFixed(4)}\n`);
  }

  const dir = path.join(process.cwd(), "evals", "out");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  out.write("\nReport: evals/out/report.json\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
