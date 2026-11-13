"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "cn";
import { signed } from "@/components/odds-widget";
import { copy, fill } from "@/lib/copy";
import { evidenceHref, evidenceLabel, type Finding } from "@/lib/findings";
import { CRITERION_MAX } from "@/lib/rubric";
import type { RubricView } from "@/lib/review";
import { ICON } from "./review-parts";

const R = copy.review.rubric;

const tone = (score: number) => (score >= 7 ? "bg-gain" : score >= 4 ? "bg-unclear" : "bg-loss");

/** One piece of evidence: a link pinned to the scanned commit, or the check's own words. */
function EvidenceLink({ finding, repo, commit }: { finding: Finding; repo: string; commit: string | null }) {
  return (
    <li className="min-w-0">
      <p className="text-[14px] leading-snug text-text-muted">{finding.title}</p>
      <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {finding.evidence.map((e, i) => {
          const href = evidenceHref(e, repo, commit ?? undefined);
          const label = evidenceLabel(e);
          return (
            <li key={i} className="min-w-0 font-mono text-[12px] text-text-subtle">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all underline decoration-1 underline-offset-4 transition-colors hover:text-text"
                >
                  {label}
                </a>
              ) : (
                <span className="break-words">{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** The scored rubric: each criterion's weight, score and bar, and a "why" that opens to the reason and its evidence. */
export function RubricBreakdown({
  rubric,
  findings,
  repo,
  commit,
}: {
  rubric: RubricView;
  findings: Finding[];
  repo: string;
  commit: string | null;
}) {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const total = rubric.criteria.reduce((n, c) => n + c.weight, 0) || 1;
  return (
    <section aria-labelledby="rubric" className="rounded-panel border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="rubric" className="text-[17px] font-bold">
            {R.heading}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-pretty text-text-subtle">{R.note}</p>
        </div>
        <p className="font-mono text-[14px] tabular-nums">
          {fill(R.aggregate, { n: rubric.aggregate })}
          {rubric.delta !== 0 && (
            <span className={cn("ml-2", rubric.delta > 0 ? "text-gain" : "text-loss")}>{signed(rubric.delta)}</span>
          )}
        </p>
      </header>
      <ul>
        {rubric.criteria.map((c) => {
          const cited = c.findings.flatMap((id) => byId.get(id) ?? []);
          return (
            <li key={c.key} className="border-b border-border last:border-0">
              <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-[16px] leading-snug font-semibold">{c.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-[12px] text-text-subtle">
                      <ChevronRight
                        aria-hidden
                        size={13}
                        strokeWidth={ICON}
                        className="transition-transform duration-200 group-open:rotate-90"
                      />
                      {R.why}
                      <span aria-hidden>·</span>
                      <span aria-hidden>{fill(R.weight, { n: Math.round((c.weight / total) * 100) })}</span>
                      <span className="sr-only">{fill(R.weightLabel, { n: Math.round((c.weight / total) * 100) })}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-border-strong sm:w-28">
                      <span
                        className={cn("block h-full origin-left rounded-full", tone(c.score))}
                        style={{ transform: `scaleX(${c.score / CRITERION_MAX})` }}
                      />
                    </span>
                    <span className="w-11 text-right font-mono text-[14px] tabular-nums">
                      <span className="sr-only">{fill(R.score, { n: c.score })}</span>
                      <span aria-hidden>{c.score}/10</span>
                    </span>
                  </span>
                </summary>
                <div className="grid gap-3 px-5 pb-4 pl-[38px]">
                  <p className="text-[15px] leading-snug text-pretty">{c.reason}</p>
                  {cited.length ? (
                    <ul className="grid gap-2">
                      {cited.map((f) => (
                        <EvidenceLink key={f.id} finding={f} repo={repo} commit={commit} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-text-subtle">{R.noEvidence}</p>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
