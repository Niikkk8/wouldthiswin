// Loads and saves sessions. Every write is conditional on the version it read, so two
// requests racing on the same session can't both succeed (e.g. a double-submitted answer).

import type { Spent } from "./budget";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ID_RE, db, sha256 } from "./db";
import { limitsFromEnv, type LimitStatus } from "./limits";
import { log } from "./log";
import type { Usage } from "./model";
import { isCachedScan, type CacheKey, type CachedScan } from "./scan-cache";
import { currentOdds } from "./odds";
import { reviewOf, type Review } from "./review";
import {
  newSession,
  toView,
  type Result,
  type SessionError,
  type SessionState,
  type SessionView,
  type SessionSettings,
  DEFAULT_SETTINGS,
} from "./session";

const OWNER_COOKIE = "wtw_owner";

/** Hash of this browser's owner token, or null if it has none. */
export async function ownerHash(): Promise<string | null> {
  const token = (await cookies()).get(OWNER_COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? sha256(token) : null;
}

/** Gives this browser an owner token if it doesn't have one. Route handlers only. */
export async function ensureOwner(): Promise<string> {
  const jar = await cookies();
  let token = jar.get(OWNER_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    jar.set(OWNER_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return sha256(token);
}

const COLUMNS =
  "id, repo, repo_url, latest_sha, act, claims, questions, answers, events, panel, signals, files, sources, settings, version, owner_hash, demo_url, input_tokens, output_tokens";

const Settings = z.object({ extendedTime: z.boolean() });

/** The settings column is untrusted shape-wise (older rows have none): anything off is the default. */
export function parseSettings(v: unknown): SessionSettings {
  const parsed = Settings.safeParse(v);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

type Row = {
  id: string;
  repo: string;
  repo_url: string;
  latest_sha: string;
  act: SessionState["act"];
  claims: SessionState["claims"];
  questions: SessionState["questions"];
  answers: SessionState["answers"];
  events: SessionState["events"];
  panel: SessionState["panel"];
  signals: SessionState["signals"];
  files: SessionState["files"];
  sources: SessionState["sources"] | null;
  version: number;
  owner_hash: string;
  demo_url: string | null;
  settings: unknown;
  input_tokens: number | null;
  output_tokens: number | null;
};

export type Loaded = {
  session: SessionState;
  version: number;
  /** The repo and commit the session was started on. */
  repoUrl: string;
  latestSha: string;
  /** The demo link the team gave on the landing page, if any. */
  demoUrl: string | null;
  /** Model tokens this session has spent so far. */
  spent: Spent;
  /** A re-review not yet scanned: the review it follows. */
  previousId: string | null;
};

/**
 * Before the scan, a re-review's link to the review it follows rides in the signals column
 * (the scan replaces it with the real signals). No extra column, no migration.
 */
type PendingSignals = { previousId: string };

function pendingPrevious(signals: unknown, claims: unknown): string | null {
  if (claims !== null || !signals || typeof signals !== "object") return null;
  const id = (signals as Partial<PendingSignals>).previousId;
  return typeof id === "string" && ID_RE.test(id) ? id : null;
}

/** Returns the session only to the browser that started it. */
export async function loadSession(id: string, owner: string | null): Promise<Loaded | null> {
  if (!ID_RE.test(id) || !owner) return null;
  const { data, error } = await db()
    .from("sessions")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data || data.owner_hash !== owner) return null;
  const previousId = pendingPrevious(data.signals, data.claims);
  const session: SessionState = {
    id: data.id,
    repo: data.repo,
    act: data.act,
    claims: data.claims,
    questions: data.questions,
    answers: data.answers,
    events: data.events,
    panel: data.panel,
    signals: previousId ? null : data.signals,
    files: data.files,
    sources: data.sources ?? [],
    settings: parseSettings(data.settings),
  };
  return {
    session,
    version: data.version,
    repoUrl: data.repo_url,
    latestSha: data.latest_sha,
    demoUrl: data.demo_url,
    spent: { input: data.input_tokens ?? 0, output: data.output_tokens ?? 0 },
    previousId,
  };
}

/** The client's view of a session, for this browser only. */
export async function loadView(id: string): Promise<SessionView | null> {
  const loaded = await loadSession(id, await ownerHash());
  return loaded ? toView(loaded.session, Date.now()) : null;
}

/** Saves only if nobody else saved since `version` was read. */
async function save(s: SessionState, version: number): Promise<boolean> {
  const { data, error } = await db()
    .from("sessions")
    .update({
      act: s.act,
      claims: s.claims,
      questions: s.questions,
      answers: s.answers,
      events: s.events,
      panel: s.panel,
      // Until the scan lands, the column holds a re-review's link (PendingSignals): keep it.
      ...(s.claims === null && s.signals === null ? {} : { signals: s.signals }),
      files: s.files,
      sources: s.sources,
      version: version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", s.id)
    .eq("version", version)
    .select("id");
  if (error) throw error;
  return data.length === 1;
}

export type MutateResult =
  | { ok: true; session: SessionState }
  | { ok: false; error: SessionError | "notFound" | "conflict"; session?: SessionState };

/** Load, apply one transition, save. On failure returns the current session so the client can resync. */
export async function mutate(
  id: string,
  owner: string | null,
  fn: (s: SessionState) => Result,
): Promise<MutateResult> {
  const loaded = await loadSession(id, owner);
  if (!loaded) return { ok: false, error: "notFound" };
  const r = fn(loaded.session);
  if (!r.ok) return { ok: false, error: r.error, session: loaded.session };
  if (r.session === loaded.session) return { ok: true, session: r.session }; // no-op
  if (!(await save(r.session, loaded.version))) {
    const now = await loadSession(id, owner);
    return { ok: false, error: "conflict", session: now?.session };
  }
  return { ok: true, session: r.session };
}

const LIMIT_STATUSES: readonly LimitStatus[] = ["ok", "rateLimited", "dailyCap", "spendCap"];

function capArgs(ipHash: string) {
  const l = limitsFromEnv();
  return { p_ip_hash: ipHash, p_user_limit: l.perUser, p_day_limit: l.perDay, p_spend_limit: l.spendUsd };
}

function asLimitStatus(data: unknown): LimitStatus {
  if (LIMIT_STATUSES.includes(data as LimitStatus)) return data as LimitStatus;
  throw new Error(`reserve_session_v2 returned ${JSON.stringify(data)}`);
}

/**
 * Checks the caps (lib/limits.ts) and inserts the session under one lock. This is the only
 * place limits are checked: a session that started is never stopped by them.
 */
export async function reserveSession(row: {
  id: string;
  repoUrl: string;
  repo: string;
  latestSha: string;
  owner: string;
  ipHash: string;
  eventSlug?: string | null;
}): Promise<LimitStatus> {
  const s = newSession(row.id, row.repo);
  const { data, error } = await db().rpc("reserve_session_v2", {
    ...capArgs(row.ipHash),
    p_id: row.id,
    p_repo_url: row.repoUrl,
    p_repo: row.repo,
    p_latest_sha: row.latestSha,
    p_owner_hash: row.owner,
    p_act: s.act,
    p_event_slug: row.eventSlug ?? null,
  });
  if (error) throw error;
  return asLimitStatus(data);
}

/** A read-only cap check, before spending GitHub calls. */
export async function checkLimits(ipHash: string): Promise<LimitStatus> {
  const { data, error } = await db().rpc("reserve_session_v2", capArgs(ipHash));
  if (error) throw error;
  return asLimitStatus(data);
}

/** This browser's most recent finished review, for the "judges are asleep" screen. */
export async function lastReviewOf(owner: string | null): Promise<{ id: string; repo: string } | null> {
  if (!owner) return null;
  const { data, error } = await db()
    .from("sessions")
    .select("id, repo")
    .eq("owner_hash", owner)
    .in("act", ["verdict", "share"])
    .not("panel", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; repo: string }>();
  if (error) throw error;
  return data;
}

/** Stores the demo link the team gave. Written right after the session is reserved. */
/** Copies the person's settings onto a session they just started. The clock reads them from here. */
export async function setSettings(id: string, settings: SessionSettings): Promise<void> {
  const { error } = await db().from("sessions").update({ settings }).eq("id", id);
  if (error) throw error;
}

/** This browser's own settings. Stored per owner cookie, never shown on public surfaces. */
export async function loadPrefs(owner: string | null): Promise<SessionSettings> {
  if (!owner) return DEFAULT_SETTINGS;
  const { data, error } = await db()
    .from("owner_prefs")
    .select("extended_time")
    .eq("owner_hash", owner)
    .maybeSingle<{ extended_time: boolean }>();
  if (error) throw error;
  return { extendedTime: data?.extended_time === true };
}

export async function savePrefs(owner: string, prefs: SessionSettings): Promise<void> {
  const { error } = await db()
    .from("owner_prefs")
    .upsert({ owner_hash: owner, extended_time: prefs.extendedTime, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function setDemoUrl(id: string, url: string): Promise<void> {
  const { error } = await db().from("sessions").update({ demo_url: url }).eq("id", id);
  if (error) throw error;
}

/** Links a re-review to the review it follows. Written right after the session is reserved. */
export async function setPreviousId(id: string, previousId: string): Promise<void> {
  const signals: PendingSignals = { previousId };
  const { error } = await db().from("sessions").update({ signals }).eq("id", id);
  if (error) throw error;
}

/** A finished review this browser owns, as a re-review needs it. Null if there isn't one. */
export async function loadOwnReview(
  id: string,
  owner: string | null,
): Promise<{ loaded: Loaded; odds: number; fixes: string[] } | null> {
  const loaded = await loadSession(id, owner);
  const s = loaded?.session;
  if (!loaded || !s || (s.act !== "verdict" && s.act !== "share") || !s.panel) return null;
  return { loaded, odds: currentOdds(s.events), fixes: s.panel.fixes };
}

/** True if this request should run the scan (nobody else is running it). */
export async function claimScan(id: string): Promise<boolean> {
  const { data, error } = await db().rpc("claim_scan", { p_id: id });
  if (error) throw error;
  return data === true;
}

/** Lets a failed scan be retried straight away. */
export async function releaseScan(id: string): Promise<void> {
  const { error } = await db().from("sessions").update({ scan_started_at: null }).eq("id", id);
  if (error) console.error(JSON.stringify({ event: "scan.release", id, error: error.message }));
}

/** A session that never cost anything shouldn't count toward the limits. */
export async function deleteSession(id: string): Promise<void> {
  const { error } = await db().from("sessions").delete().eq("id", id);
  if (error) console.error(JSON.stringify({ event: "session.delete", id, error: error.message }));
}

/**
 * Records what a step spent: the session's running token totals (its budget) and one
 * `session_usage` row per model call (the spend limit and the stats). A failed write is
 * logged, never thrown: accounting must not break a session.
 */
export async function addUsage(id: string, usage: Usage) {
  if (!usage.calls.length) return;
  const [totals, rows] = await Promise.all([
    db().rpc("add_session_usage", { p_id: id, p_input: usage.inputTokens, p_output: usage.outputTokens }),
    db()
      .from("session_usage")
      .insert(
        usage.calls.map((c) => ({
          session_id: id,
          step: c.step,
          model: c.model,
          input_tokens: c.inputTokens,
          output_tokens: c.outputTokens,
          cache_read_tokens: c.cacheReadTokens,
          cache_write_tokens: c.cacheWriteTokens,
          usd: c.usd,
          duration_ms: c.ms,
        })),
      ),
  ]);
  for (const r of [totals, rows]) if (r.error) log.error("session.usage", { id, error: r.error.message });
}

/** How long a step without a model call took (fetching the repo, checking the demo). */
export async function addStepTiming(id: string, step: string, ms: number) {
  const { error } = await db().from("session_usage").insert({ session_id: id, step, duration_ms: Math.round(ms) });
  if (error) log.error("session.step", { id, step, error: error.message });
}

/**
 * Cached findings for this repo, commit and scan version (lib/scan-cache.ts). Findings at a
 * commit never change, but checks do: SCAN_VERSION is part of the key, and rows go after
 * CACHE_DAYS (lib/retention.ts) so nothing lingers.
 */
export async function getCachedScan(key: CacheKey): Promise<CachedScan | null> {
  const { data, error } = await db()
    .from("scan_cache_v2")
    .select("scan")
    .eq("owner", key.owner)
    .eq("repo", key.repo)
    .eq("sha", key.sha)
    .eq("scan_version", key.version)
    .maybeSingle<{ scan: unknown }>();
  if (error) throw error;
  return data && isCachedScan(data.scan) ? data.scan : null;
}

export async function putCachedScan(key: CacheKey, scan: CachedScan) {
  const { error } = await db().from("scan_cache_v2").upsert({
    owner: key.owner,
    repo: key.repo,
    sha: key.sha,
    scan_version: key.version,
    scan,
    created_at: new Date().toISOString(),
  });
  if (error) log.error("scan.cachePut", { repo: `${key.owner}/${key.repo}`, error: error.message });
}

const PANEL_LOCK_SECONDS = 90;

/**
 * True if this request should run act 3's deliberation call. A lock that's older than
 * 90s (a crashed request) can be taken over.
 */
export async function claimPanel(id: string): Promise<boolean> {
  const stale = new Date(Date.now() - PANEL_LOCK_SECONDS * 1000).toISOString();
  const { data, error } = await db()
    .from("sessions")
    .update({ panel_started_at: new Date().toISOString() })
    .eq("id", id)
    .is("panel", null)
    .or(`panel_started_at.is.null,panel_started_at.lt.${stale}`)
    .select("id");
  if (error) throw error;
  return data.length === 1;
}

/** Lets a failed deliberation be retried straight away. */
export async function releasePanel(id: string): Promise<void> {
  const { error } = await db().from("sessions").update({ panel_started_at: null }).eq("id", id);
  if (error) console.error(JSON.stringify({ event: "panel.release", id, error: error.message }));
}

/**
 * The review for anyone with the link. Reads only what the review is built from: never
 * the answers, the questions or the deliberation chat. Null until act 4.
 */
export async function loadPublicReview(id: string): Promise<Review | null> {
  if (!ID_RE.test(id)) return null;
  const { data, error } = await db()
    .from("sessions")
    .select("id, repo, act, claims, events, panel, signals, questions, answers")
    .eq("id", id)
    .maybeSingle<Pick<Row, "id" | "repo" | "act" | "claims" | "events" | "panel" | "signals" | "questions" | "answers">>();
  if (error) throw error;
  if (!data || (data.act !== "verdict" && data.act !== "share") || !data.panel) return null;
  // Only the parts the review uses; the chat, the questions' text and the answers' text stay
  // out even in memory. The judging sheet needs who asked and what each answer scored.
  const panel = { ...data.panel, chat: [] };
  const questions = data.questions.map((q) => ({ judge: q.judge, text: "", caught: null, issuedAt: null }));
  const answers = data.answers.map((a) => ({ ...a, text: "", reason: null }));
  return reviewOf({
    ...newSession(data.id, data.repo),
    act: data.act,
    claims: data.claims,
    events: data.events,
    panel,
    signals: data.signals,
    questions,
    answers,
  });
}

/** True if this browser started the session. */
export async function isOwner(id: string): Promise<boolean> {
  const owner = await ownerHash();
  if (!owner || !ID_RE.test(id)) return false;
  const { data } = await db().from("sessions").select("owner_hash").eq("id", id).maybeSingle<{ owner_hash: string }>();
  return data?.owner_hash === owner;
}
