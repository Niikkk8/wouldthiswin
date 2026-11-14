// The IP the rate limit counts against. Only the hosting platform's word is taken: a client
// can put anything in x-real-ip or x-forwarded-for, so those headers are ignored unless
// Vercel itself set them.

import { isIPv6 } from "node:net";

type Env = Record<string, string | undefined>;

/** Every request without a platform-set IP shares this one bucket, so spoofing buys nothing. */
export const UNKNOWN_IP = "unknown";

/**
 * - On Vercel (VERCEL=1): `x-real-ip`, which Vercel's edge sets and overwrites, so a
 *   client-sent value never reaches the function.
 * - In tests only (WTW_TEST_IP_HEADER=1, and never in production): `x-test-ip`, so local
 *   runs can simulate several visitors.
 * - Anywhere else: one shared bucket.
 */
export function clientIp(req: Request, env: Env = process.env): string {
  if (env.VERCEL === "1") {
    return req.headers.get("x-real-ip")?.trim() || UNKNOWN_IP;
  }
  if (env.WTW_TEST_IP_HEADER === "1" && env.NODE_ENV !== "production") {
    return req.headers.get("x-test-ip")?.trim() || UNKNOWN_IP;
  }
  return UNKNOWN_IP;
}

/**
 * What the per-IP limit counts. One IPv6 subscriber gets a whole /64 (2^64 addresses) and
 * can pick a fresh one per request, so IPv6 counts by its /64. IPv4 counts per address.
 */
export function limitKey(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  if (!isIPv6(ip)) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
