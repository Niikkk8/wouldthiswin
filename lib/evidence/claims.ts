// Turns extracted claims and the agent's verdicts into the session's claims: the shape the
// odds engine, the scan act, the findings and the review already read. Pure.

import { copy, fill } from "../copy";
import type { ClaimStatus } from "../odds";
import type { Claim } from "../session";
import { SOURCE_CHARS, type Source } from "../sources";
import type { ExtractedClaim } from "./extract";
import type { Verdict, VerdictStatus } from "./verify";

/** How a verdict scores: partly there and unverified both cost a little; missing costs most. */
const STATUS: Record<VerdictStatus, ClaimStatus> = {
  supported: "backed",
  partial: "unclear",
  unsupported: "unbacked",
  cant_verify: "unclear",
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function toClaims(
  extracted: readonly ExtractedClaim[],
  verdicts: readonly Verdict[],
  files: ReadonlyMap<string, string>,
): Claim[] {
  return extracted.map((c) => {
    const v = verdicts.find((x) => x.id === c.id) ?? {
      id: c.id,
      status: "cant_verify" as const,
      reason: copy.evidence.notChecked,
      citations: [],
    };
    const first = v.citations[0];
    const quote = first
      ? (files.get(first.path)?.split(/\r?\n/)[first.start - 1]?.trim().slice(0, 120) ?? null)
      : null;
    const name = clip(c.text, 50);
    const label = {
      supported: fill(copy.scan.foundLabel, { claim: name }),
      partial: fill(copy.scan.partlyLabel, { claim: name }),
      unsupported: fill(copy.scan.notInCodeLabel, { claim: name }),
      cant_verify: fill(copy.scan.cantVerify, { claim: name }),
    }[v.status];
    return {
      claim: c.text,
      status: STATUS[v.status],
      weight: c.weight,
      file: v.status === "unsupported" ? null : (first?.path ?? null),
      evidence: v.reason,
      label: clip(label, 80),
      missing: v.status === "unsupported" ? c.text : null,
      searched: v.status === "unsupported" ? [...new Set(v.citations.map((x) => x.path))] : [],
      quote: v.status === "unsupported" ? null : quote,
      line: v.status === "unsupported" ? null : (first?.start ?? null),
      verdict: v.status,
      category: c.category,
      source: c.source,
      span: c.span,
      citations: v.citations,
    };
  });
}

/**
 * The files the review may quote: those the agent read, most-cited first, at most 10, each
 * cut the way the scan always cut them.
 */
export function sourcesFrom(
  files: ReadonlyMap<string, string>,
  verdicts: readonly Verdict[],
  limit = 10,
): Source[] {
  const cites = new Map<string, number>();
  for (const v of verdicts)
    for (const c of v.citations) cites.set(c.path, (cites.get(c.path) ?? 0) + 1);
  return [...files.keys()]
    .sort((a, b) => (cites.get(b) ?? 0) - (cites.get(a) ?? 0))
    .slice(0, limit)
    .map((path) => {
      const text = files.get(path)!;
      return {
        path,
        text: text.slice(0, SOURCE_CHARS),
        ...(text.length > SOURCE_CHARS ? { truncated: true } : {}),
      };
    });
}
