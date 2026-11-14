// Checks 1 and 2: secrets in the current tree, and env files still in git history. Private
// findings: a leaked key is the owner's to fix, never a public talking point. Only a redacted
// prefix and the path and line are ever kept; the secret itself goes nowhere.

import { copy, fill } from "../copy";
import type { Finding } from "../findings";
import type { RepoSnapshot } from "./types";

type Pattern = { name: string; re: RegExp; minEntropy?: number };

// Each pattern is the provider's documented key shape. Placeholders ("sk-your-key-here")
// fail the entropy test, which real keys pass easily.
const PATTERNS: Pattern[] = [
  {
    name: "Anthropic API key",
    re: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{40,}/g,
    minEntropy: 4,
  },
  {
    name: "OpenAI API key",
    re: /\bsk-(?:proj-|svcacct-)?(?!ant-)[A-Za-z0-9_-]{32,}/g,
    minEntropy: 4,
  },
  { name: "Groq API key", re: /\bgsk_[A-Za-z0-9]{40,}/g, minEntropy: 4 },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, minEntropy: 4 },
  { name: "AWS access key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, minEntropy: 3 },
  { name: "Stripe live key", re: /\b(?:sk|rk)_live_[0-9a-zA-Z]{20,}/g, minEntropy: 4 },
  {
    name: "GitHub token",
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})/g,
    minEntropy: 4,
  },
  {
    name: "Private key",
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
  },
];

const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/g;

/** Real env files, not templates. */
export const ENV_FILE = /(^|\/)\.env(\.(local|development|dev|production|prod|staging|test))?$/i;
export const ENV_TEMPLATE = /(^|\/)\.env\.(example|sample|template|dist)$/i;

/** Bits per character: real keys are random, placeholders aren't. */
export function entropy(s: string): number {
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** The first few characters and nothing else: enough to find it, useless to anyone else. */
export function redact(secret: string): string {
  return `${secret.slice(0, Math.min(6, Math.floor(secret.length / 4)))}…`;
}

/** A Supabase key is a JWT; it's only dangerous if its role claim is service_role. */
export function jwtRole(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

type Hit = { name: string; path: string; line: number; secret: string };

/** Words only a placeholder has. */
const PLACEHOLDER = /your|xxxx|example|placeholder|here|dummy|changeme|replace/i;

function hitsIn(path: string, text: string): Hit[] {
  const hits: Hit[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.re)) {
        if (PLACEHOLDER.test(m[0]) || (p.minEntropy && entropy(m[0]) < p.minEntropy)) continue;
        hits.push({ name: p.name, path, line: i + 1, secret: m[0] });
      }
    }
    for (const m of line.matchAll(JWT)) {
      if (jwtRole(m[0]) === "service_role")
        hits.push({ name: "Supabase service-role key", path, line: i + 1, secret: m[0] });
    }
  });
  return hits;
}

const S = copy.checks.secrets;

/** Check 1: keys in the files at this commit, and env files committed at all. */
export function secretsInTree(s: RepoSnapshot): Finding[] {
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const [path, text] of s.files) {
    for (const h of hitsIn(path, text)) {
      const key = `${h.path}:${h.line}:${h.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `secret-${out.length + 1}`,
        check: "secrets",
        outcome: "fail",
        severity: "blocker",
        title: fill(S.title, { name: h.name }),
        detail: fill(S.detail, { prefix: redact(h.secret), path: h.path, line: h.line }),
        evidence: [{ kind: "file", path: h.path, startLine: h.line, endLine: h.line }],
        fix: S.fix,
        effort: "30m",
        visibility: "private",
      });
    }
  }
  for (const path of s.tree.filter((p) => ENV_FILE.test(p) && !ENV_TEMPLATE.test(p))) {
    out.push({
      id: `env-${out.length + 1}`,
      check: "secrets",
      outcome: "fail",
      severity: "blocker",
      title: fill(S.envTitle, { path }),
      detail: S.envDetail,
      evidence: [{ kind: "file", path }],
      fix: S.fix,
      effort: "30m",
      visibility: "private",
    });
  }
  return out;
}

/** Check 2: env files that any commit ever touched, even if they're gone now. */
export function secretsInHistory(s: RepoSnapshot): Finding[] {
  return Object.entries(s.envHistory)
    .filter(([path, shas]) => shas.length > 0 && !ENV_TEMPLATE.test(path))
    .map(([path, shas], i) => ({
      id: `history-${i + 1}`,
      check: "history",
      outcome: "fail" as const,
      severity: "major" as const,
      title: fill(S.historyTitle, { path }),
      detail: fill(S.historyDetail, { sha: shas[shas.length - 1].slice(0, 7) }),
      evidence: shas.slice(0, 3).map((sha) => ({ kind: "commit" as const, sha })),
      fix: S.historyFix,
      effort: "30m" as const,
      visibility: "private" as const,
    }));
}
