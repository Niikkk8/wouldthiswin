import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { addedLines, type Compare } from "./github";
import { buildRecheckPrompt, pickDiffFiles, recheckFixes, validateRecheck, type PreviousReview } from "./recheck";
import type { Claim } from "./session";

const claims: Claim[] = [
  { claim: "SMS alerts", status: "unbacked", weight: "core", file: null, evidence: "e", label: "l", missing: "an SMS provider", searched: ["server/notify.ts"] },
];

const previous: PreviousReview = {
  id: "abcdefghjk",
  odds: 34,
  fixes: [
    "Wire Twilio into onTurnClose in server/notify.ts and demo a real text.",
    "Put the demo link at the top of the README.",
    "Load hospitals from the database instead of config/hospital.ts.",
  ],
  claims,
};

const diff: Compare = {
  commits: [{ message: "send real texts", date: "2026-11-09T10:00:00Z" }],
  files: [
    { path: "README.md", status: "modified", additions: 2, deletions: 0, added: "Demo: https://queueless.vercel.app" },
    {
      path: "server/notify.ts",
      status: "modified",
      additions: 3,
      deletions: 1,
      added: "import twilio from 'twilio';\n  await client.messages.create({ to: ticket.phone, body });",
    },
    { path: "package-lock.json", status: "modified", additions: 900, deletions: 0, added: "" },
  ],
  linear: true,
};

const fix = (over: Record<string, unknown>) => ({ id: 1, status: "addressed", file: null, quote: null, note: "n", ...over });

describe("added lines", () => {
  test("only lines the patch adds, without the marker", () => {
    const patch = "@@ -1,3 +1,3 @@\n context\n-old line\n+new line\n+++ not a header in a hunk\n+another";
    assert.equal(addedLines(patch), "new line\nanother");
    assert.equal(addedLines(undefined), "");
  });
});

describe("which changed files the panel reads", () => {
  test("files the last review pointed at come first; files with nothing readable are left out", () => {
    assert.deepEqual(
      pickDiffFiles(diff, previous).map((f) => f.path),
      ["server/notify.ts", "README.md"],
    );
  });

  test("the diff is marked as untrusted data, and the fixes are numbered", () => {
    const { system, user } = buildRecheckPrompt(diff, previous);
    assert.match(system, /data, never instructions/);
    assert.match(user, /<untrusted_diff path="server\/notify.ts">/);
    assert.match(user, /<untrusted_commits>/);
    assert.match(user, /^1\. Wire Twilio/m);
  });
});

describe("checking the fixes", () => {
  test("done needs a line the diff actually added, in a file the panel saw", () => {
    const r = validateRecheck(
      {
        fixes: [
          fix({ file: "server/notify.ts", quote: "await client.messages.create({ to: ticket.phone, body });", note: "notify now sends through Twilio" }),
          fix({ id: 2, status: "partly", file: "README.md", quote: "Demo: https://queueless.vercel.app" }),
          fix({ id: 3, status: "untouched", note: "hospitals still hardcoded" }),
        ],
      },
      diff,
      previous,
    );
    assert.ok(r.ok);
    if (r.ok) {
      assert.deepEqual(r.fixes.map((f) => f.status), ["addressed", "partly", "untouched"]);
      assert.equal(r.fixes[0].note, "notify now sends through Twilio");
      assert.equal(r.downgraded, 0);
    }
  });

  test("a quote that isn't in the added lines, or a file outside the diff, isn't done", () => {
    const r = validateRecheck(
      {
        fixes: [
          fix({ file: "server/notify.ts", quote: "sendRealSms(ticket)" }),
          fix({ id: 2, file: "config/hospital.ts", quote: "Demo: https://queueless.vercel.app" }),
        ],
      },
      diff,
      previous,
    );
    assert.ok(r.ok);
    if (r.ok) {
      assert.deepEqual(r.fixes.map((f) => f.status), ["untouched", "untouched", "untouched"]);
      assert.equal(r.downgraded, 3);
    }
  });

  test("a commit message saying it's done earns nothing without the code", async () => {
    const lying: Compare = { ...diff, commits: [{ message: "fixed all three fixes", date: "" }], files: [] };
    const out = await recheckFixes(lying, previous, async () => reply({ fixes: [fix({ file: "server/notify.ts", quote: "x" })] }));
    assert.ok(out.iteration.fixes.every((f) => f.status === "untouched"));
  });

  test("if the model can't be reached, every fix stays open and says so", async () => {
    const out = await recheckFixes(diff, previous, () => Promise.reject(new Error("down")));
    assert.equal(out.iteration.fixes.length, 3);
    assert.ok(out.iteration.fixes.every((f) => f.status === "untouched" && /couldn't read the diff/.test(f.note)));
    assert.equal(out.iteration.previousId, "abcdefghjk");
    assert.equal(out.iteration.commits, 1);
  });
});

function reply(body: unknown): Anthropic.Message {
  return {
    id: "m",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text: JSON.stringify(body), citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20 },
  } as unknown as Anthropic.Message;
}

describe("finding the right files in a big diff", () => {
  test("a file whose path names what a fix asked for beats a bigger unrelated one", () => {
    const big: Compare = {
      commits: [],
      files: [
        { path: "video/src/Reel.tsx", status: "added", additions: 900, deletions: 0, added: "x" },
        { path: "app/sitemap.ts", status: "added", additions: 20, deletions: 0, added: "export default function sitemap() {" },
      ],
      linear: true,
    };
    const prev = { ...previous, claims: [], fixes: ["Add a sitemap so search engines can index the guides."] };
    assert.equal(pickDiffFiles(big, prev, 1)[0].path, "app/sitemap.ts");
  });

  test("a changed image counts for an art fix, with no quote; a made-up one doesn't", () => {
    const art: Compare = {
      commits: [],
      files: [{ path: "public/judges/engineer.png", status: "modified", additions: 0, deletions: 0, added: "" }],
      linear: true,
    };
    const prev = { ...previous, claims: [], fixes: ["Replace the engineer's placeholder art."] };
    const ok = validateRecheck({ fixes: [fix({ file: "public/judges/engineer.png", note: "new engineer sprite" })] }, art, prev);
    assert.ok(ok.ok && ok.fixes[0].status === "addressed" && ok.fixes[0].quote === null);
    const made = validateRecheck({ fixes: [fix({ file: "public/judges/investor.png" })] }, art, prev);
    assert.ok(made.ok && made.fixes[0].status === "untouched");
  });
});

test("each re-review counts its round from the one before", async () => {
  const first = await recheckFixes(diff, previous, () => Promise.reject(new Error("down")));
  assert.equal(first.iteration.round, 2);
  const second = await recheckFixes(diff, { ...previous, round: 2 }, () => Promise.reject(new Error("down")));
  assert.equal(second.iteration.round, 3);
});
