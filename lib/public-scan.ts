// The public scan behind the CLI (`npx wouldthiswin owner/repo`): the deterministic checks and
// claim extraction on a public repo, no grilling. Cached by repo, commit and scan version; a
// fresh scan counts toward 3 per IP per day. Only public findings ever leave the server.

import { z } from "zod";
import { aiDepthFindings } from "./checks/ai-depth";
import { db, newId } from "./db";
import { extractClaims, type ClaimCategory } from "./evidence/extract";
import { claimSources } from "./evidence/sources";
import { publicFindings, type Finding } from "./findings";
import { fetchLatestSha, fetchRepoData, type RepoRef } from "./github";
import { log } from "./log";
import { newUsage, usdOf, type Usage } from "./model";
import { deterministicChecks } from "./scan";
import { SCAN_VERSION } from "./scan-cache";
import type { Claim } from "./session";

export const PUBLIC_SCAN_LIMIT = 3;

export type PublicReport = {
  id: string;
  repo: string;
  sha: string;
  createdAt: string;
  claims: { text: string; category: ClaimCategory }[];
  findings: Finding[];
};

const Report = z.object({
  id: z.string(),
  repo: z.string(),
  sha: z.string(),
  createdAt: z.string(),
  claims: z.array(z.object({ text: z.string(), category: z.string() })),
  findings: z.array(z.record(z.string(), z.unknown())),
});

/** A stored report, checked on the way out of the database. */
function asReport(v: unknown): PublicReport | null {
  return Report.safeParse(v).success ? (v as PublicReport) : null;
}

/** Since midnight UTC: the same day the session caps use. */
const dayStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
};

export async function loadPublicReport(id: string): Promise<PublicReport | null> {
  if (!/^[a-z2-9]{10}$/.test(id)) return null;
  const { data, error } = await db()
    .from("public_scans")
    .select("report")
    .eq("id", id)
    .maybeSingle<{ report: unknown }>();
  if (error) throw error;
  return data ? asReport(data.report) : null;
}

async function cached(repo: string, sha: string): Promise<PublicReport | null> {
  const { data, error } = await db()
    .from("public_scans")
    .select("report")
    .eq("repo", repo)
    .eq("sha", sha)
    .eq("scan_version", SCAN_VERSION)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ report: unknown }>();
  if (error) throw error;
  return data ? asReport(data.report) : null;
}

async function freshToday(ipHash: string): Promise<number> {
  const { count, error } = await db()
    .from("public_scans")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", dayStart());
  if (error) throw error;
  return count ?? 0;
}

async function logUsage(usage: Usage) {
  if (!usage.calls.length) return;
  const { error } = await db()
    .from("session_usage")
    .insert(
      usage.calls.map((c) => ({
        session_id: null,
        step: `public.${c.step}`,
        model: c.model,
        input_tokens: c.inputTokens,
        output_tokens: c.outputTokens,
        cache_read_tokens: c.cacheReadTokens,
        cache_write_tokens: c.cacheWriteTokens,
        usd: c.usd,
        duration_ms: c.ms,
      })),
    );
  if (error) log.error("public.usage", { error: error.message });
}

export type PublicScanResult =
  { kind: "ok"; report: PublicReport; cached: boolean } | { kind: "limited" };

/** Throws GitHubError for a missing, private or empty repo, like the session start does. */
export async function publicScan(ref: RepoRef, ipHash: string): Promise<PublicScanResult> {
  const repo = `${ref.owner}/${ref.repo}`;
  const sha = await fetchLatestSha(ref);
  const hit = await cached(repo, sha);
  if (hit) return { kind: "ok", report: hit, cached: true };
  if ((await freshToday(ipHash)) >= PUBLIC_SCAN_LIMIT) return { kind: "limited" };

  const raw = await fetchRepoData(ref.url);
  const usage = newUsage();
  const [extracted, checks] = await Promise.all([
    extractClaims(claimSources({ readme: raw.readmeFull, devpost: null, submission: null }), usage),
    deterministicChecks(raw, null, null, { signatures: [], entered: [] }),
  ]);
  // Unverified on purpose: the CLI doesn't run the agent, so no claim is called supported.
  const claims: Claim[] = extracted.map((c) => ({
    claim: c.text,
    status: "unclear",
    weight: c.weight,
    file: null,
    evidence: "",
    label: "",
    missing: null,
    searched: [],
    category: c.category,
  }));
  const findings = publicFindings([
    ...checks.findings,
    ...aiDepthFindings(checks.depth, claims, checks.pretrained),
  ]);
  const report: PublicReport = {
    id: newId(),
    repo,
    sha: raw.latestSha,
    createdAt: new Date().toISOString(),
    claims: extracted.map((c) => ({ text: c.text, category: c.category })),
    findings,
  };
  const { error } = await db()
    .from("public_scans")
    .insert({
      id: report.id,
      repo,
      sha: raw.latestSha,
      scan_version: SCAN_VERSION,
      ip_hash: ipHash,
      report,
      usd: usdOf(usage),
    });
  if (error) throw error;
  await logUsage(usage);
  return { kind: "ok", report, cached: false };
}
