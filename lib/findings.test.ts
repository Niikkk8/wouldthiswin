import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { evidenceHref, evidenceLabel, findingsOf, publicFindings } from "./findings";
import type { Claim, ScanSignals } from "./session";

const claim = (over: Partial<Claim>): Claim => ({
  claim: "SMS alerts",
  status: "backed",
  weight: "core",
  file: "lib/sms.ts",
  evidence: "e",
  label: "l",
  missing: null,
  searched: [],
  quote: "twilio.messages.create(",
  line: 12,
  ...over,
});

const signals = (over: Partial<ScanSignals> = {}): ScanSignals => ({
  demo: { status: "loads", url: "https://q.vercel.app/" },
  bulkFirstCommit: false,
  commit: "a".repeat(40),
  ...over,
});

describe("findings", () => {
  test("every finding cites something", () => {
    const fs = findingsOf({
      claims: [claim({}), claim({ status: "unbacked", file: null, searched: ["package.json"], missing: "an SMS provider" }), claim({ status: "unclear", file: null })],
      signals: signals({ demo: { status: "none", url: null }, bulkFirstCommit: true }),
    });
    assert.ok(fs.every((f) => f.evidence.length > 0));
    assert.deepEqual(fs.map((f) => f.id), ["claim-1", "claim-2", "claim-3", "demo", "commits"]);
  });

  test("a missing core claim is a blocker; a mocked one is major; unclear is minor", () => {
    const [missing, mocked, unclear] = findingsOf({
      claims: [claim({ status: "unbacked", searched: ["a.ts"] }), claim({ status: "mocked" }), claim({ status: "unclear" })],
      signals: null,
    });
    assert.deepEqual([missing.severity, mocked.severity, unclear.severity], ["blocker", "major", "minor"]);
    assert.equal(findingsOf({ claims: [claim({ status: "unbacked", weight: "minor", searched: ["a.ts"] })], signals: null })[0].severity, "major");
  });

  test("passes have no fix; problems have one line", () => {
    const [pass, fail] = findingsOf({ claims: [claim({}), claim({ status: "mocked" })], signals: null });
    assert.equal(pass.fix, null);
    assert.match(fail.fix ?? "", /lib\/sms\.ts/);
  });

  test("timeline findings are private and never on a public surface", () => {
    const fs = findingsOf({ claims: [], signals: signals({ bulkFirstCommit: true }) });
    const commits = fs.find((f) => f.id === "commits");
    assert.equal(commits?.visibility, "private");
    assert.equal(commits?.fix, null);
    assert.ok(!publicFindings(fs).some((f) => f.id === "commits"));
  });
});

describe("evidence links", () => {
  const sha = "b".repeat(40);

  test("files link to the exact commit and line", () => {
    assert.equal(
      evidenceHref({ kind: "file", path: "lib/sms.ts", startLine: 12, endLine: 14 }, "team/app", sha),
      `https://github.com/team/app/blob/${sha}/lib/sms.ts#L12-L14`,
    );
    assert.equal(evidenceLabel({ kind: "file", path: "lib/sms.ts", startLine: 12, endLine: 12 }), "lib/sms.ts:12");
  });

  test("odd characters in paths are encoded, folders are kept", () => {
    assert.equal(evidenceHref({ kind: "file", path: "src/my file#1.ts" }, "t/a", sha), `https://github.com/t/a/blob/${sha}/src/my%20file%231.ts`);
  });

  test("commits link to the commit; a check's own words have no link", () => {
    assert.equal(evidenceHref({ kind: "commit", sha }, "t/a", undefined), `https://github.com/t/a/commit/${sha}`);
    assert.equal(evidenceLabel({ kind: "commit", sha }), "bbbbbbb");
    assert.equal(evidenceHref({ kind: "check", detail: "x" }, "t/a", sha), null);
  });
});
