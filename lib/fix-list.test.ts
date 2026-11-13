import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { Finding } from "./findings";
import { checklistMarkdown, fixItems, issueUrl, itemMarkdown } from "./fix-list";

const SHA = "c".repeat(40);

const finding = (over: Partial<Finding>): Finding => ({
  id: "claim-1",
  check: "claim",
  outcome: "fail",
  severity: "major",
  title: "SMS alerts",
  detail: "d",
  evidence: [{ kind: "file", path: "lib/sms.ts", startLine: 4, endLine: 4 }],
  fix: "Wire up Twilio.",
  effort: "2h",
  visibility: "public",
  ...over,
});

describe("fix items", () => {
  test("only findings with a fix, sorted by severity then effort", () => {
    const items = fixItems(
      [
        finding({ id: "claim-1", severity: "minor", effort: "5m" }),
        finding({ id: "claim-2", severity: "blocker", effort: "2h" }),
        finding({ id: "demo", severity: "blocker", effort: "30m" }),
        finding({ id: "claim-3", outcome: "pass", severity: null, fix: null, effort: null }),
        finding({ id: "commits", outcome: "warn", severity: "minor", fix: null, effort: null }),
      ],
      "team/app",
      SHA,
    );
    assert.deepEqual(items.map((i) => i.id), ["demo", "claim-2", "claim-1"]);
  });

  test("evidence links point at the scanned commit", () => {
    const [item] = fixItems([finding({})], "team/app", SHA);
    assert.deepEqual(item.evidence, [{ label: "lib/sms.ts:4", href: `https://github.com/team/app/blob/${SHA}/lib/sms.ts#L4` }]);
  });

  test("nothing to fix is an empty list, not an invented one", () => {
    assert.deepEqual(fixItems([finding({ outcome: "pass", severity: null, fix: null, effort: null })], "t/a", SHA), []);
  });
});

describe("markdown", () => {
  test("a checklist line per item, with severity, effort and evidence", () => {
    const [item] = fixItems([finding({})], "team/app", SHA);
    assert.equal(
      itemMarkdown(item),
      `- [ ] **SMS alerts** (Major, 2 h): Wire up Twilio. (evidence: [lib/sms.ts:4](https://github.com/team/app/blob/${SHA}/lib/sms.ts#L4))`,
    );
    assert.match(checklistMarkdown([item], "team/app"), /^## Fix before you submit: team\/app\n\n- \[ \]/);
  });
});

describe("GitHub issue link", () => {
  test("prefills title and body on the repo's own new-issue page", () => {
    const [item] = fixItems([finding({})], "team/app", SHA);
    const url = new URL(issueUrl(item, "team/app", "abcdefghjk"));
    assert.equal(url.origin + url.pathname, "https://github.com/team/app/issues/new");
    assert.equal(url.searchParams.get("title"), "SMS alerts");
    assert.match(url.searchParams.get("body") ?? "", /Wire up Twilio\.[\s\S]*lib\/sms\.ts:4[\s\S]*\/s\/abcdefghjk/);
  });

  test("a huge body falls back to the fix alone", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ kind: "file" as const, path: `src/very/long/path/number/${i}/file.ts` }));
    const [item] = fixItems([finding({ evidence: many })], "team/app", SHA);
    assert.equal(new URL(issueUrl(item, "team/app", "abcdefghjk")).searchParams.get("body"), "Wire up Twilio.");
  });
});
