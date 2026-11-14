// Clears sessions and scan-cache rows made by local runs and tests.
//
//   npm run clear-test-data                 dry run: lists what would go, deletes nothing
//   npm run clear-test-data -- --yes        deletes it
//
// A test session is one whose rate-limit bucket can't come from production: the shared
// "unknown" bucket (every request off Vercel), loopback, or a documentation-range IP (192.0.2.x,
// 198.51.100.x, 203.0.113.x) sent through the test-only x-test-ip header. A scan-cache row
// goes only if every session that used it is a test session, plus any repo given with
// --repo. The database in .env may be production: run the dry run first.

import { UNKNOWN_IP } from "../lib/client-ip";
import { db, hashIp } from "../lib/db";

const args = process.argv.slice(2);
const apply = args.includes("--yes");
const extraRepos = args.flatMap((a, i) => (args[i - 1] === "--repo" ? [a.toLowerCase()] : []));

const TEST_RANGES = ["192.0.2", "198.51.100", "203.0.113"];
// Loopback: local dev before the platform-only IP rule. Never a production visitor.
const LOOPBACK = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];
const testIps = [
  UNKNOWN_IP,
  ...LOOPBACK,
  ...TEST_RANGES.flatMap((r) => Array.from({ length: 256 }, (_, i) => `${r}.${i}`)),
];

async function main() {
  const host = new URL(process.env.SUPABASE_URL ?? "http://missing").host;
  console.log(`Database: ${host}${apply ? "" : "  (dry run: nothing is deleted)"}`);

  const hashes = testIps.map(hashIp);
  const sessions: { id: string; repo_url: string; act: string; created_at: string }[] = [];
  for (let i = 0; i < hashes.length; i += 200) {
    const { data, error } = await db()
      .from("sessions")
      .select("id, repo_url, act, created_at")
      .in("ip_hash", hashes.slice(i, i + 200));
    if (error) throw error;
    sessions.push(...data);
  }

  // Cache rows used only by test sessions.
  const testRepos = new Set(sessions.map((s) => s.repo_url));
  const testHashes = new Set(hashes);
  if (testRepos.size) {
    const { data: uses, error } = await db()
      .from("sessions")
      .select("repo_url, ip_hash")
      .in("repo_url", [...testRepos]);
    if (error) throw error;
    for (const r of uses) if (!testHashes.has(r.ip_hash)) testRepos.delete(r.repo_url);
  }
  for (const r of extraRepos) testRepos.add(r);

  let cache: { repo_url: string; latest_sha: string; created_at: string }[] = [];
  if (testRepos.size) {
    const { data, error } = await db()
      .from("scan_cache")
      .select("repo_url, latest_sha, created_at")
      .in("repo_url", [...testRepos]);
    if (error) throw error;
    cache = data;
  }

  console.log(`\nTest sessions: ${sessions.length}`);
  for (const s of sessions)
    console.log(`  ${s.id}  ${s.act.padEnd(12)} ${s.created_at}  ${s.repo_url}`);
  console.log(`\nScan cache rows: ${cache.length}`);
  for (const c of cache)
    console.log(`  ${c.repo_url}  ${c.latest_sha.slice(0, 7)}  ${c.created_at}`);

  if (!apply) {
    console.log("\nDry run. Re-run with --yes to delete these.");
    return;
  }
  for (let i = 0; i < sessions.length; i += 200) {
    const { error } = await db()
      .from("sessions")
      .delete()
      .in(
        "id",
        sessions.slice(i, i + 200).map((s) => s.id),
      );
    if (error) throw error;
  }
  if (cache.length) {
    const { error } = await db()
      .from("scan_cache")
      .delete()
      .in("repo_url", [...testRepos]);
    if (error) throw error;
  }
  console.log(`\nDeleted ${sessions.length} sessions and ${cache.length} cache rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
