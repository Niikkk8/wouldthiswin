import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { DEFAULT_RUBRIC } from "../rubric";
import { FIXTURE_EVENT } from "./fixture";
import { allEvents, eventBySlug, eventStatus, judgeContextFor, rubricFor } from "./index";
import { EVENT_PRESETS } from "./presets";
import { EventPreset } from "./types";

describe("event presets", () => {
  test("every preset, and the fixture, passes the schema", () => {
    for (const e of [...EVENT_PRESETS, FIXTURE_EVENT]) {
      const r = EventPreset.safeParse(e);
      assert.ok(r.success, `${e.slug}: ${r.success ? "" : r.error.message}`);
    }
  });

  test("slugs are unique", () => {
    const slugs = [...EVENT_PRESETS, FIXTURE_EVENT].map((e) => e.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test("a preset needs a deadline, exact or in words", () => {
    const r = EventPreset.safeParse({ ...FIXTURE_EVENT, endsAt: null, deadlineText: null });
    assert.equal(r.success, false);
  });

  test("the made-up fixture never exists in production", () => {
    assert.equal(eventBySlug("fixture-hack", { NODE_ENV: "production" }), null);
    assert.ok(!allEvents({ NODE_ENV: "production" }).includes(FIXTURE_EVENT));
    assert.equal(eventBySlug("fixture-hack", { NODE_ENV: "test" }), FIXTURE_EVENT);
  });
});

describe("event state", () => {
  const e = { startsAt: "2026-11-13T09:00:00+00:00", endsAt: "2026-11-15T12:00:00+00:00" };

  test("upcoming, open, then closed at the deadline", () => {
    assert.equal(eventStatus(e, Date.parse("2026-11-13T08:59:59Z")), "upcoming");
    assert.equal(eventStatus(e, Date.parse("2026-11-14T00:00:00Z")), "open");
    assert.equal(eventStatus(e, Date.parse("2026-11-15T12:00:00Z")), "closed");
  });

  test("a deadline in words keeps it open", () => {
    assert.equal(eventStatus({ ...e, endsAt: null }, Date.parse("2030-01-01T00:00:00Z")), "open");
  });
});

describe("rubric and context", () => {
  test("an event's rubric, else the default", () => {
    assert.equal(rubricFor("fixture-hack"), FIXTURE_EVENT.rubric);
    assert.equal(rubricFor(null), DEFAULT_RUBRIC);
    assert.equal(rubricFor("no-such-event"), DEFAULT_RUBRIC);
  });

  test("judge context comes only from a preset", () => {
    assert.match(judgeContextFor("fixture-hack"), /Fixture Hack/);
    assert.equal(judgeContextFor(null), "");
  });
});
