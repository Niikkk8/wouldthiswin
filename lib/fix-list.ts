// "Fix before you submit": the findings that have a fix, sorted so the worst and quickest
// come first, as a markdown checklist and as prefilled GitHub issues. Only real findings
// with evidence make the list; the panel's opinions don't.

import { copy, fill } from "./copy";
import { evidenceHref, evidenceLabel, type Effort, type Finding, type Severity } from "./findings";
import { SITE_URL } from "./site";

export type FixItem = {
  id: string;
  severity: Severity;
  effort: Effort;
  title: string;
  fix: string;
  evidence: { label: string; href: string | null }[];
};

const SEVERITY_ORDER: Record<Severity, number> = { blocker: 0, major: 1, minor: 2 };
const EFFORT_ORDER: Record<Effort, number> = { "5m": 0, "30m": 1, "2h": 2 };

export function fixItems(
  findings: readonly Finding[],
  repo: string,
  commit: string | null,
): FixItem[] {
  return findings
    .filter(
      (f): f is Finding & { severity: Severity; effort: Effort; fix: string } =>
        f.outcome !== "pass" && !!f.fix && !!f.severity && !!f.effort,
    )
    .map((f) => ({
      id: f.id,
      severity: f.severity,
      effort: f.effort,
      title: f.title,
      fix: f.fix,
      evidence: f.evidence.map((e) => ({
        label: evidenceLabel(e),
        href: evidenceHref(e, repo, commit ?? undefined),
      })),
    }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
}

const L = copy.fixList;

const evidenceMd = (item: FixItem) =>
  item.evidence.map((e) => (e.href ? `[${e.label}](${e.href})` : e.label)).join(", ");

/** One item as a markdown checklist line. */
export function itemMarkdown(item: FixItem): string {
  const tag = `${L.severity[item.severity]}, ${L.effort[item.effort]}`;
  const evidence = evidenceMd(item);
  return `- [ ] **${item.title}** (${tag}): ${item.fix}${evidence ? ` ${fill(L.evidenceMd, { evidence })}` : ""}`;
}

export function checklistMarkdown(items: readonly FixItem[], repo: string): string {
  return [`## ${fill(L.mdHeading, { repo })}`, "", ...items.map(itemMarkdown)].join("\n");
}

// Browsers and GitHub handle URLs well past this, but a long one can be cut by proxies.
const MAX_ISSUE_URL = 6000;

/** A prefilled "new issue" link on the repo itself. No OAuth: the team opens it in their own browser. */
export function issueUrl(item: FixItem, repo: string, reviewId: string): string {
  const evidence = item.evidence
    .map((e) => `- ${e.href ? `[${e.label}](${e.href})` : e.label}`)
    .join("\n");
  const body = [
    item.fix,
    "",
    `**${L.severityLabel}:** ${L.severity[item.severity]}  `,
    `**${L.effortLabel}:** ${L.effort[item.effort]}`,
    ...(evidence ? ["", `**${L.evidenceLabel}**`, evidence] : []),
    "",
    fill(L.issueFooter, { url: `${SITE_URL}/s/${reviewId}` }),
  ].join("\n");
  const make = (b: string) =>
    `https://github.com/${repo}/issues/new?${new URLSearchParams({ title: item.title, body: b }).toString()}`;
  const url = make(body);
  return url.length <= MAX_ISSUE_URL ? url : make(item.fix);
}
