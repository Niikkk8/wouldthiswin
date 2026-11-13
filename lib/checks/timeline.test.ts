import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { commitShare, timelineFindings, type CommitLite } from "./timeline";

const c = (date: string, author = "asha", sha = date): CommitLite => ({ sha, date, author });
const window = { start: "2026-11-13T09:00:00Z", end: "2026-11-15T12:00:00Z" };

describe("timeline", () => {
  test("one setup commit before the start is fine; two are worth being ready for", () => {
    assert.deepEqual(timelineFindings([c("2026-11-10T00:00:00Z"), c("2026-11-14T00:00:00Z")], window, false), []);
    const [f] = timelineFindings([c("2026-11-10T00:00:00Z"), c("2026-11-11T00:00:00Z"), c("2026-11-14T00:00:00Z")], window, false);
    assert.equal(f.title, "2 commits from before the start");
    assert.equal(f.visibility, "private");
    assert.doesNotMatch(f.detail, /cheat|violat|against the rules/i);
  });

  test("commits after the deadline, with how late", () => {
    const [f] = timelineFindings([c("2026-11-15T14:30:00Z"), c("2026-11-14T00:00:00Z")], window, false);
    assert.equal(f.title, "1 commit after the deadline");
    assert.match(f.detail, /about 3h after/);
  });

  test("a team project with one committer, and a lopsided split", () => {
    const solo = [c("2026-11-14T01:00:00Z"), c("2026-11-14T02:00:00Z"), c("2026-11-14T03:00:00Z")];
    assert.equal(timelineFindings(solo, null, true)[0].title, "All 3 commits are from one person");
    assert.deepEqual(timelineFindings(solo, null, false), []);
    const lopsided = [...Array.from({ length: 9 }, (_, i) => c(`2026-11-14T0${i}:00:00Z`)), c("2026-11-14T10:00:00Z", "ben")];
    assert.equal(timelineFindings(lopsided, null, false)[0].title, "90% of commits are from one person");
  });

  test("no window, no timeline findings; every finding cites something", () => {
    assert.deepEqual(timelineFindings([c("2020-01-01T00:00:00Z")], null, false), []);
    const all = timelineFindings([c("2026-11-10T00:00:00Z"), c("2026-11-11T00:00:00Z"), c("2026-11-16T00:00:00Z")], window, true);
    assert.ok(all.every((f) => f.evidence.length > 0));
  });

  test("commit share per author", () => {
    assert.deepEqual(commitShare([c("a"), c("b"), c("c", "ben")]), [{ author: "asha", share: 67 }, { author: "ben", share: 33 }]);
  });
});
