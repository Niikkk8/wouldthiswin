import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Judgment, Usage } from "./judge";
import type { Signals } from "./signals";

export const IP_LIMIT_PER_24H = 3;

let supabase: SupabaseClient | null = null;

/** Server-only client using the service role key. Never import from client components. */
export function db(): SupabaseClient {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabase;
}

export function dailyCap(): number {
  const n = Number.parseInt(process.env.DAILY_CAP ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 150;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("IP_HASH_SALT not set");
  return sha256(`${salt}:${ip}`);
}

export const hashPitch = (pitch: string | null) => sha256(pitch ?? "");

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789"; // no l/1/0 lookalikes
/** 10-char slug, ~50 bits. */
export function newId(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export type CacheKey = {
  repoUrl: string;
  latestSha: string;
  demoUrl: string; // '' when absent
  pitchHash: string;
};

export async function findCached(key: CacheKey): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await db()
    .from("judgments")
    .select("id")
    .eq("repo_url", key.repoUrl)
    .eq("latest_sha", key.latestSha)
    .eq("demo_url", key.demoUrl)
    .eq("pitch_hash", key.pitchHash)
    .eq("status", "done")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export type LimitStatus = "ok" | "rateLimited" | "dailyCap";

/** Read-only limit check (no row created). */
export async function checkLimits(ipHash: string): Promise<LimitStatus> {
  const { data, error } = await db().rpc("reserve_judgment", {
    p_ip_hash: ipHash,
    p_ip_limit: IP_LIMIT_PER_24H,
    p_daily_cap: dailyCap(),
  });
  if (error) throw error;
  return data as LimitStatus;
}

/** Atomically re-checks limits and inserts a pending row. */
export async function reserve(
  ipHash: string,
  row: CacheKey & { id: string; pitch: string | null; signals: Signals },
): Promise<LimitStatus> {
  const { data, error } = await db().rpc("reserve_judgment", {
    p_ip_hash: ipHash,
    p_ip_limit: IP_LIMIT_PER_24H,
    p_daily_cap: dailyCap(),
    p_id: row.id,
    p_repo_url: row.repoUrl,
    p_latest_sha: row.latestSha,
    p_demo_url: row.demoUrl,
    p_pitch: row.pitch,
    p_pitch_hash: row.pitchHash,
    p_signals: row.signals,
  });
  if (error) throw error;
  return data as LimitStatus;
}

export async function completeJudgment(id: string, result: Judgment, usage: Usage) {
  const { error } = await db()
    .from("judgments")
    .update({
      status: "done",
      result,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Tokens were spent: keep the row as failed so it still counts toward limits.
 * No tokens spent (API down): delete it so the user isn't charged a slot.
 */
export async function failJudgment(id: string, usage: Usage) {
  const q = db().from("judgments");
  const { error } =
    usage.inputTokens > 0
      ? await q
          .update({
            status: "failed",
            input_tokens: usage.inputTokens,
            output_tokens: usage.outputTokens,
          })
          .eq("id", id)
      : await q.delete().eq("id", id);
  if (error) console.error(JSON.stringify({ event: "judge.failRecord", id, error: error.message }));
}
