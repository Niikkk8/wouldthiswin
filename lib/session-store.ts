// Loads and saves sessions. Every write is conditional on the version it read, so two
// requests racing on the same session can't both succeed (e.g. a double-submitted answer).

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { ID_RE, IP_LIMIT_PER_24H, dailyCap, db, sha256 } from "./db";
import {
  newSession,
  toView,
  type Result,
  type SessionError,
  type SessionState,
  type SessionView,
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

const COLUMNS = "id, repo, act, claims, questions, answers, events, panel, version, owner_hash";

type Row = {
  id: string;
  repo: string;
  act: SessionState["act"];
  claims: SessionState["claims"];
  questions: SessionState["questions"];
  answers: SessionState["answers"];
  events: SessionState["events"];
  panel: SessionState["panel"];
  version: number;
  owner_hash: string;
};

export type Loaded = { session: SessionState; version: number };

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
  const session: SessionState = {
    id: data.id,
    repo: data.repo,
    act: data.act,
    claims: data.claims,
    questions: data.questions,
    answers: data.answers,
    events: data.events,
    panel: data.panel,
  };
  return { session, version: data.version };
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
