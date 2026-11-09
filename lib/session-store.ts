// Loads and saves sessions. Every write is conditional on the version it read, so two
// requests racing on the same session can't both succeed (e.g. a double-submitted answer).

import type { Spent } from "./budget";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { ID_RE, IP_LIMIT_PER_24H, dailyCap, db, sha256 } from "./db";
import { currentOdds } from "./odds";
import { reviewOf, type Review } from "./review";
import {
  newSession,
  toView,
  type Result,
  type SessionError,
  type SessionState,
  type SessionView,
  type Scan,
} from "./session";

export type LimitStatus = "ok" | "rateLimited" | "dailyCap";

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
  "id, repo, repo_url, latest_sha, act, claims, questions, answers, events, panel, signals, files, sources, version, owner_hash, demo_url, input_tokens, output_tokens";

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

/** Checks the per-IP limit and the daily cap, and inserts the session under a lock. */
export async function reserveSession(row: {
  id: string;
  repoUrl: string;
  repo: string;
  latestSha: string;
  owner: string;
  ipHash: string;
}): Promise<LimitStatus> {
  const s = newSession(row.id, row.repo);
  const { data, error } = await db().rpc("reserve_session", {
    p_ip_hash: row.ipHash,
    p_ip_limit: IP_LIMIT_PER_24H,
    p_daily_cap: dailyCap(),
    p_id: row.id,
    p_repo_url: row.repoUrl,
    p_repo: row.repo,
    p_latest_sha: row.latestSha,
    p_owner_hash: row.owner,
    p_act: s.act,
  });
  if (error) throw error;
  return data as LimitStatus;
}

/** A read-only limit check, before spending GitHub calls. */
export async function checkLimits(ipHash: string): Promise<LimitStatus> {
  const { data, error } = await db().rpc("reserve_session", {
    p_ip_hash: ipHash,
    p_ip_limit: IP_LIMIT_PER_24H,
    p_daily_cap: dailyCap(),
  });
  if (error) throw error;
  return data as LimitStatus;
}

/** Stores the demo link the team gave. Written right after the session is reserved. */
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

export async function addUsage(id: string, usage: { inputTokens: number; outputTokens: number }) {
  if (!usage.inputTokens && !usage.outputTokens) return;
  const { error } = await db().rpc("add_session_usage", {
    p_id: id,
    p_input: usage.inputTokens,
    p_output: usage.outputTokens,
  });
  if (error) console.error(JSON.stringify({ event: "session.usage", id, error: error.message }));
}

const CACHE_HOURS = 24;

/** A scan of this exact commit from the last 24 hours, if there is one. */
export async function getCachedScan(repoUrl: string, latestSha: string): Promise<Scan | null> {
  const since = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await db()
    .from("scan_cache")
    .select("scan")
    .eq("repo_url", repoUrl)
    .eq("latest_sha", latestSha)
    .gte("created_at", since)
    .maybeSingle<{ scan: Scan }>();
  if (error) throw error;
  // Scans from before the files were read (no `sources`) are re-run.
  return data?.scan && Array.isArray(data.scan.sources) ? data.scan : null;
}

export async function putCachedScan(repoUrl: string, latestSha: string, scan: Scan) {
  const { error } = await db()
    .from("scan_cache")
    .upsert({ repo_url: repoUrl, latest_sha: latestSha, scan, created_at: new Date().toISOString() });
  if (error) console.error(JSON.stringify({ event: "scan.cachePut", repoUrl, error: error.message }));
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
