import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, test } from "vitest";
import { newUsage } from "../model";
import { SONNET, HAIKU } from "../pricing";
import type { ExtractedClaim } from "./extract";
import type { RepoReader } from "./repo-tools";
import { agentModel, verifyClaims, type AgentStep } from "./verify";

const FILES: Record<string, string> = {
  "package.json": '{ "dependencies": { "next": "16" } }',
  "src/predict.ts": "export function predict() {\n  return Math.random();\n}\n",
};
const repo: RepoReader = { tree: Object.keys(FILES), read: async (p) => FILES[p] ?? null };

const claims: ExtractedClaim[] = [
  {
    id: "c1",
    text: "Predicts density with a custom ML model",
    category: "ai",
    source: "readme",
    span: "custom ML model",
    weight: "core",
  },
  {
    id: "c2",
    text: "Streams data in real time",
    category: "performance",
    source: "readme",
    span: "real-time",
    weight: "core",
  },
];

const msg = (content: unknown[], stop: string): Anthropic.Message =>
  ({
    model: SONNET,
    content,
    stop_reason: stop,
    usage: { input_tokens: 1000, output_tokens: 100 },
  }) as unknown as Anthropic.Message;
const toolUse = (id: string, name: string, input: unknown) => ({
  type: "tool_use",
  id,
  name,
  input,
});
const answer = (verdicts: unknown) =>
  msg([{ type: "text", text: JSON.stringify({ verdicts }) }], "end_turn");

/** A scripted model: each call returns the next reply. */
function script(...replies: Anthropic.Message[]): {
  step: AgentStep;
  seen: Anthropic.MessageParam[][];
} {
  const seen: Anthropic.MessageParam[][] = [];
  return {
    seen,
    step: async (req) => (seen.push(structuredClone(req.messages)), replies.shift()!),
  };
}

describe("verification agent", () => {
  test("reads, then cites the lines it read", async () => {
    const s = script(
      msg([toolUse("t1", "read_file", { path: "src/predict.ts" })], "tool_use"),
      answer([
        {
          id: "c1",
          status: "partial",
          reason: "predict returns Math.random(), not a model.",
          citations: [{ path: "src/predict.ts", start: 1, end: 3 }],
        },
        {
          id: "c2",
          status: "supported",
          reason: "Says so.",
          citations: [{ path: "src/stream.ts", start: 1, end: 2 }],
        },
      ]),
    );
    const usage = newUsage();
    const reads: string[] = [];
    const out = await verifyClaims(claims, repo, usage, {
      step: s.step,
      onRead: (p) => reads.push(p),
    });
    assert.deepEqual(
      out.verdicts.map((v) => v.status),
      ["partial", "cant_verify"],
    );
    assert.deepEqual(out.verdicts[0].citations, [{ path: "src/predict.ts", start: 1, end: 3 }]);
    assert.deepEqual(reads, ["src/predict.ts"]);
    assert.equal(usage.calls.length, 2);
    // The tool result went back to the model.
    const toolResult = (s.seen[1].at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    assert.match(String(toolResult.content), /Math\.random/);
  });

  test("a citation of lines it wasn't shown doesn't count", async () => {
    const s = script(
      msg([toolUse("t1", "read_file", { path: "src/predict.ts", start: 1, end: 1 })], "tool_use"),
      answer([
        {
          id: "c1",
          status: "supported",
          reason: "r",
          citations: [{ path: "src/predict.ts", start: 1, end: 3 }],
        },
      ]),
    );
    const out = await verifyClaims(claims, repo, newUsage(), { step: s.step });
    assert.equal(out.verdicts[0].status, "cant_verify");
  });

  test("out of time means can't verify, never a guess", async () => {
    let t = 0;
    const s = script(msg([toolUse("t1", "list_tree", {})], "tool_use"), answer([]));
    const out = await verifyClaims(claims, repo, newUsage(), {
      step: async (r) => ((t += 40_000), s.step(r)),
      now: () => t,
      timeMs: 30_000,
    });
    assert.ok(out.verdicts.every((v) => v.status === "cant_verify"));
  });

  test("an API error or a refusal leaves every claim unverified, and the scan goes on", async () => {
    const failing: AgentStep = async () => {
      throw new Error("overloaded");
    };
    assert.ok(
      (await verifyClaims(claims, repo, newUsage(), { step: failing })).verdicts.every(
        (v) => v.status === "cant_verify",
      ),
    );
    const refused = script(msg([], "refusal"));
    assert.ok(
      (await verifyClaims(claims, repo, newUsage(), { step: refused.step })).verdicts.every(
        (v) => v.status === "cant_verify",
      ),
    );
  });

  test("Sonnet unless the flag says Haiku", () => {
    assert.equal(agentModel({}), SONNET);
    assert.equal(agentModel({ CLAIM_AGENT_MODEL: "haiku" }), HAIKU);
  });
});
