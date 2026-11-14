// The public board: a hall of fame, not a feed. Pure rules, so they're tested without the
// database; lib/session-store.ts reads the rows and hands them here.
//
// Who can appear:
// - Only finished verdicts (act 4 or the share screen, panel written).
// - Only Honorable mention or better. Participating is never listed.
// - Only verdicts their owner listed (and made shareable), and nobody hid. The privacy text at
//   launch said "Nothing is listed or searchable", so sessions from before the opt-in existed
//   are never listed on their own: they appear only if their owner opts in since.
// - Never the app owner's own repos (test runs and demos).
// Fewer than BOARD_MIN_ENTRIES qualifying verdicts and the board shows its empty state, so a
// thin board never puts two or three teams on display.

import type { ActName, Claim, Panel } from "./session";
import { currentOdds, tierFor, type OddsEvent, type Tier } from "./odds";

/** The app owner's GitHub account. Its repos never appear on the board. */
export const APP_OWNER = "niikkk8";

export const DEFAULT_BOARD_MIN_ENTRIES = 5;

/** Tiers the board shows, best first. Participating never makes it. */
export const BOARD_TIERS: readonly Tier[] = ["winner", "top3", "honorable"];

/** BOARD_MIN_ENTRIES from the environment: a whole number of at least 1, else the default. */
export function boardMinEntries(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.BOARD_MIN_ENTRIES);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_BOARD_MIN_ENTRIES;
}

export type BoardRow = {
  id: string;
  repo: string;
  act: ActName;
  events: OddsEvent[];
  claims: Claim[] | null;
  panel: Pick<Panel, "oneLiner"> | null;
  shareable: boolean;
  listed: boolean;
  hidden_at: string | null;
  updated_at: string;
  owner_hash: string | null;
};

/** What the board may show: public-safe fields only, plus the id for the verdict link. */
export type BoardEntry = {
  id: string;
  repo: string;
  odds: number;
  tier: Tier;
  oneLiner: string;
  /** When the verdict was written (ISO). */
  at: string;
  /** This browser listed it, so it may hide it. Never the owner's hash itself. */
  mine: boolean;
};

export const BOARD_SORTS = ["recent", "top"] as const;
export type BoardSort = (typeof BOARD_SORTS)[number];

const ownerOf = (repo: string) => repo.split("/")[0]?.toLowerCase() ?? "";

/** One row's place on the board, or null when it doesn't qualify. */
export function boardEntry(row: BoardRow, viewer: string | null): BoardEntry | null {
  if (row.act !== "verdict" && row.act !== "share") return null;
  if (!row.panel?.oneLiner) return null;
  if (!row.listed || !row.shareable || row.hidden_at) return null;
  if (ownerOf(row.repo) === APP_OWNER) return null;
  const odds = currentOdds(row.events);
  const tier = tierFor(odds);
  if (!BOARD_TIERS.includes(tier)) return null;
  return {
    id: row.id,
    repo: row.repo,
    odds,
    tier,
    oneLiner: row.panel.oneLiner,
    at: row.updated_at,
    mine: !!viewer && row.owner_hash === viewer,
  };
}

/** The board: qualifying rows, sorted, or none at all below the minimum. */
export function boardOf(
  rows: readonly BoardRow[],
  opts: { sort: BoardSort; viewer: string | null; minEntries: number; limit?: number },
): BoardEntry[] {
  const entries = rows
    .map((r) => boardEntry(r, opts.viewer))
    .filter((e): e is BoardEntry => e !== null);
  if (entries.length < opts.minEntries) return [];
  entries.sort((a, b) =>
    opts.sort === "top" ? b.odds - a.odds || b.at.localeCompare(a.at) : b.at.localeCompare(a.at),
  );
  return entries.slice(0, opts.limit ?? 100);
}
