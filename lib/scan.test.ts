import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { ExtractedClaim } from "./evidence/extract";
import type { Verdict } from "./evidence/verify";
import type { RawRepoData } from "./github";
import type { WrittenQuestion } from "./grill/questions";
import { ScanError, runScanModel, type ScanDeps } from "./scan";

const raw = {
  ref: { owner: "team", repo: "pulse", url: "https://github.com/team/pulse" },
  meta: { fullName: "team/pulse", description: "Crowd analytics" },
  readmeFull: "# PulseBoard\nReal-time streaming. A custom ML model predicts density.",
  headFilePaths: ["src/predict.ts", "package.json"],
  latestSha: "a".repeat(40),
} as unknown as RawRepoData;

const extracted: ExtractedClaim[] = [
  { id: "c1", text: "Custom ML model predicts density", category: "ai", source: "readme", span: "A custom ML model predicts density.", weight: "core" },
  { id: "c2", text: "Real-time streaming", category: "performance", source: "readme", span: "Real-time streaming.", weight: "core" },
];
const questions: WrittenQuestion[] = [
  { judge: "tired", text: "In one sentence. What is it?", caught: null, kind: "fact" },
  { judge: "investor", text: "Who pays?", caught: null, kind: "decision" },
  { judge: "engineer", text: "Why is Math.random() a model?", caught: "Math.random()", kind: "tradeoff" },
];
const files = new Map([["src/predict.ts", "export function predict() {\n  return Math.random();\n}"]]);
const verdicts: Verdict[] = [{ id: "c1", status: "partial", reason: "predict returns Math.random().", citations: [{ path: "src/predict.ts", start: 2, end: 2 }] }];

const deps = (over: Partial<ScanDeps> = {}): Partial<ScanDeps> => ({
  extract: async () => extracted,
  verify: async (_c, _r, _u, onRead) => (onRead("src/predict.ts"), { verdicts, files }),
  questions: async () => questions,
  devpost: async () => null,
  read: async () => null,
  ...over,
});

describe("the scan pipeline", () => {
  test("extracted claims come back with the agent's verdicts, citations and quoted line", async () => {
    const r = await runScanModel(raw, { deps: deps() });
    assert.deepEqual(r.claims.map((c) => [c.claim, c.status, c.verdict]), [
      ["Custom ML model predicts density", "unclear", "partial"],
      ["Real-time streaming", "unclear", "cant_verify"],
    ]);
    assert.equal(r.claims[0].file, "src/predict.ts");
    assert.equal(r.claims[0].line, 2);
    assert.equal(r.claims[0].quote, "return Math.random();");
    assert.deepEqual(r.sources.map((s) => s.path), ["src/predict.ts"]);
    assert.equal(r.questions.length, 3);
  });

  test("progress is real: claims found, checking, then each file as it's read", async () => {
    const events: string[] = [];
    await runScanModel(raw, { deps: deps(), emit: (p) => events.push(p.type === "claims" ? `claims:${p.claims.length}` : p.type) });
    assert.deepEqual(events, ["claims:2", "checking", "reading", "read"]);
  });

  test("if the check fails, nothing is reported missing: every claim is unverified", async () => {
    const r = await runScanModel(raw, { deps: deps({ verify: async () => Promise.reject(new Error("GitHub down")) }) });
    assert.ok(r.claims.every((c) => c.verdict === "cant_verify" && c.status === "unclear"));
  });

  test("a failed extraction fails the scan", async () => {
    await assert.rejects(runScanModel(raw, { deps: deps({ extract: async () => Promise.reject(new Error("bad")) }) }), ScanError);
  });

  test("the pasted submission is a claim source", async () => {
    let kinds: string[] = [];
    await runScanModel(raw, {
      submission: { devpostUrl: null, text: "Deployed to production." },
      deps: deps({ extract: async (s) => ((kinds = s.map((x) => x.kind)), extracted) }),
    });
    assert.deepEqual(kinds, ["readme", "submission"]);
  });
});
