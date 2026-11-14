import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  APP_OWNER,
  DEFAULT_BOARD_MIN_ENTRIES,
  boardEntry,
  boardMinEntries,
  boardOf,
  type BoardRow,
} from "./board";
import type { OddsEvent } from "./odds";

/** Odds end at `odds`: one event from 50. */
const at = (odds: number): OddsEvent[] => [
  { act: 1, kind: "claim", delta: odds - 50, reason: "r", before: 50, after: odds },
];

const row = (over: Partial<BoardRow> = {}): BoardRow => ({
  id: "abc123defg",
  repo: "team/project",
  act: "share",
  events: at(60),
  claims: [],
  panel: { oneLiner: "the one that ships" },
  shareable: true,
  listed: true,
  hidden_at: null,
  updated_at: "2026-11-12T10:00:00.000Z",
  owner_hash: "owner-1",
  ...over,
});

const rows = (n: number, over: (i: number) => Partial<BoardRow> = () => ({})) =>
  Array.from({ length: n }, (_, i) =>
    row({
      id: `id${i}`,
      repo: `team${i}/p`,
      updated_at: `2026-11-1${i}T10:00:00.000Z`,
      ...over(i),
    }),
  );

describe("boardEntry", () => {
  test("a listed, finished Honorable mention or better makes it, with public fields only", () => {
    const e = boardEntry(row(), null);
    assert.deepEqual(e, {
      id: "abc123defg",
      repo: "team/project",
      odds: 60,
      tier: "top3",
      oneLiner: "the one that ships",
      at: "2026-11-12T10:00:00.000Z",
      mine: false,
    });
  });

  test("tiers: Winner, Top 3 and Honorable mention qualify; Participating never does", () => {
    assert.equal(boardEntry(row({ events: at(84) }), null)?.tier, "winner");
    assert.equal(boardEntry(row({ events: at(55) }), null)?.tier, "top3");
    assert.equal(boardEntry(row({ events: at(30) }), null)?.tier, "honorable");
    assert.equal(boardEntry(row({ events: at(29) }), null), null);
    assert.equal(boardEntry(row({ events: at(18) }), null), null);
  });

  test("only finished verdicts: act 4 or share, with a panel", () => {
    assert.ok(boardEntry(row({ act: "verdict" }), null));
    for (const act of ["scan", "grilling", "deliberation"] as const)
      assert.equal(boardEntry(row({ act }), null), null);
    assert.equal(boardEntry(row({ panel: null }), null), null);
  });

  test("only opt-ins: listed and shareable, and not hidden", () => {
    // Sessions from before the opt-in are shareable but not listed: the launch privacy text
    // said nothing was listed, so they stay off.
    assert.equal(boardEntry(row({ listed: false }), null), null);
    assert.equal(boardEntry(row({ shareable: false }), null), null);
    assert.equal(boardEntry(row({ hidden_at: "2026-11-13T00:00:00Z" }), null), null);
  });

  test("never the app owner's repos, whatever the case", () => {
    assert.equal(boardEntry(row({ repo: `${APP_OWNER}/wouldthiswin` }), null), null);
    assert.equal(boardEntry(row({ repo: "NIIKKK8/anything" }), null), null);
    // A repo merely named like the owner is fine.
    assert.ok(boardEntry(row({ repo: `someone/${APP_OWNER}` }), null));
  });

  test("mine: only for the browser that owns it", () => {
    assert.equal(boardEntry(row(), "owner-1")?.mine, true);
    assert.equal(boardEntry(row(), "owner-2")?.mine, false);
    assert.equal(boardEntry(row({ owner_hash: null }), null)?.mine, false);
  });
});

describe("boardOf", () => {
  test("empty below the minimum, counting only rows that qualify", () => {
    const four = rows(4);
    const withLosers = [...four, ...rows(3, (i) => ({ id: `low${i}`, events: at(20) }))];
    assert.deepEqual(boardOf(withLosers, { sort: "recent", viewer: null, minEntries: 5 }), []);
    assert.equal(boardOf(rows(5), { sort: "recent", viewer: null, minEntries: 5 }).length, 5);
  });

  test("recent sorts newest first; top sorts by odds, then newest", () => {
    const list = rows(5, (i) => ({ events: at([40, 70, 70, 90, 35][i]) }));
    const recent = boardOf(list, { sort: "recent", viewer: null, minEntries: 1 });
    assert.deepEqual(
      recent.map((e) => e.id),
      ["id4", "id3", "id2", "id1", "id0"],
    );
    const top = boardOf(list, { sort: "top", viewer: null, minEntries: 1 });
    assert.deepEqual(
      top.map((e) => e.id),
      ["id3", "id2", "id1", "id0", "id4"],
    );
  });

  test("the limit applies after sorting", () => {
    const list = rows(6, (i) => ({ events: at(40 + i) }));
    const top = boardOf(list, { sort: "top", viewer: null, minEntries: 1, limit: 2 });
    assert.deepEqual(
      top.map((e) => e.odds),
      [45, 44],
    );
  });
});

describe("boardMinEntries", () => {
  test("defaults to 5", () => {
    assert.equal(DEFAULT_BOARD_MIN_ENTRIES, 5);
    assert.equal(boardMinEntries({}), 5);
    assert.equal(boardMinEntries({ BOARD_MIN_ENTRIES: "" }), 5);
    assert.equal(boardMinEntries({ BOARD_MIN_ENTRIES: "nope" }), 5);
    assert.equal(boardMinEntries({ BOARD_MIN_ENTRIES: "0" }), 5);
  });

  test("reads a whole number of at least 1", () => {
    assert.equal(boardMinEntries({ BOARD_MIN_ENTRIES: "1" }), 1);
    assert.equal(boardMinEntries({ BOARD_MIN_ENTRIES: "12.7" }), 12);
  });
});
