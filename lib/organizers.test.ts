import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { demoState } from "./demo/fixture";
import { OrganizerRequest, eventStats, statsKey, statsKeyValid } from "./organizers";

const env = { EVENT_STATS_SECRET: "test-secret-for-hmac" };

describe("stats links", () => {
  test("a key opens its own event and no other", () => {
    const key = statsKey("fixture-hack", env)!;
    assert.equal(statsKeyValid("fixture-hack", key, env), true);
    assert.equal(statsKeyValid("other-event", key, env), false);
    assert.equal(statsKeyValid("fixture-hack", undefined, env), false);
  });

  test("without a secret configured, no link works", () => {
    assert.equal(statsKey("fixture-hack", {}), null);
    assert.equal(statsKeyValid("fixture-hack", "anything", {}), false);
  });
});

describe("event stats", () => {
  test("counts, the average over finished sessions, and finding types, never repo names", () => {
    const done = demoState("verdict");
    const started = demoState("scanned");
    const s = eventStats([done, started]);
    assert.equal(s.sessions, 2);
    assert.equal(s.finished, 1);
    assert.equal(s.averageOdds, 37);
    assert.ok(s.topFindings.some((f) => f.check === "claim"));
    assert.doesNotMatch(JSON.stringify(s), /queueless/);
  });

  test("no sessions, no average", () => {
    assert.deepEqual(eventStats([]), {
      sessions: 0,
      finished: 0,
      averageOdds: null,
      topFindings: [],
    });
  });
});

describe("organizer requests", () => {
  test("need a name, a URL and a contact", () => {
    assert.equal(
      OrganizerRequest.safeParse({ name: "Hack", url: "https://hack.example", contact: "a@b.co" })
        .success,
      true,
    );
    assert.equal(
      OrganizerRequest.safeParse({ name: "Hack", url: "not a url", contact: "a@b.co" }).success,
      false,
    );
    assert.equal(
      OrganizerRequest.safeParse({ name: "Hack", url: "https://hack.example" }).success,
      false,
    );
  });
});
