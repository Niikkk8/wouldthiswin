import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { buildPitch, setupSteps } from "./pitch";
import type { Claim } from "./session";

const claim = (text: string, verdict: Claim["verdict"], file: string | null = null): Claim => ({
  claim: text,
  status: verdict === "supported" ? "backed" : "unclear",
  weight: "core",
  file,
  evidence: "",
  label: "",
  missing: null,
  searched: [],
  verdict,
});
const claims = [
  claim("Join the queue by scanning a QR code", "supported", "server/queue.ts"),
  claim("Real-time streaming of crowd data", "partial"),
  claim("Custom ML model predicts density", "unsupported"),
];
const facts = {
  stack: ["TypeScript", "Next.js"],
  setup: ["git clone https://github.com/t/q && cd q", "pnpm install", "pnpm dev"],
};

describe("honest pitch", () => {
  const p = buildPitch({
    repo: "team/queueless",
    oneLiner: "the one that put the waiting room on a QR code",
    claims,
    facts,
  });

  test("the README has only what the code backs, with its file", () => {
    assert.match(p.readme, /- Join the queue by scanning a QR code \(`server\/queue\.ts`\)/);
    assert.doesNotMatch(p.readme, /Real-time|Custom ML/);
    assert.match(p.readme, /pnpm dev/);
  });

  test("everything else is listed as left out, never pitched", () => {
    assert.deepEqual(p.leftOut, [
      "Real-time streaming of crowd data",
      "Custom ML model predicts density",
    ]);
    assert.doesNotMatch(p.submission, /What works today:[^.]*(real-time|custom ml)/i);
    assert.match(p.submission, /Not done yet, and we won't claim it until it is/);
  });

  test("the submission never runs past 250 words", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      claim(`Supported feature number ${i} that does a useful thing`, "supported"),
    );
    assert.ok(buildPitch({ repo: "t/a", oneLiner: "x", claims: many, facts }).words <= 250);
  });

  test("no em dashes", () => {
    assert.doesNotMatch(p.readme + p.submission, /\u2014/);
  });
});

describe("setup steps", () => {
  test("the repo's own package manager and scripts", () => {
    const raw = {
      ref: { owner: "t", repo: "q", url: "" },
      packageJson: '{"scripts":{"dev":"next dev"}}',
      requirementsTxt: null,
      headFilePaths: ["pnpm-lock.yaml", ".env.example"],
    };
    assert.deepEqual(setupSteps(raw), [
      "git clone https://github.com/t/q && cd q",
      "cp .env.example .env  # then fill in the values",
      "pnpm install",
      "pnpm dev",
    ]);
  });

  test("python repos", () => {
    const raw = {
      ref: { owner: "t", repo: "q", url: "" },
      packageJson: null,
      requirementsTxt: "flask",
      headFilePaths: [],
    };
    assert.deepEqual(setupSteps(raw).slice(1), ["pip install -r requirements.txt"]);
  });
});
