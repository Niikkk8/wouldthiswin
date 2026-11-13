import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("IP_HASH_SALT not set");
  return sha256(`${salt}:${ip}`);
}

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789"; // no l/1/0 lookalikes
/** 10-char slug, ~50 bits. */
export function newId(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const ID_RE = /^[a-z2-9]{10}$/;
