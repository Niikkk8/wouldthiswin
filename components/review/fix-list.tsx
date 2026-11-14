"use client";

import { CircleCheck, ExternalLink } from "lucide-react";
import { cn } from "cn";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { checklistMarkdown, issueUrl, itemMarkdown, type FixItem } from "@/lib/fix-list";
import type { Severity } from "@/lib/findings";
import { ICON } from "./review-parts";

const L = copy.fixList;

const SEVERITY: Record<Severity, string> = {
  blocker: "bg-loss text-bg",
  major: "bg-unclear text-bg",
  minor: "border border-border-strong text-text-muted",
};

/** The fix list: the findings with a fix, worst and quickest first, each one copyable or openable as an issue. */
export function FixList({
  items,
  repo,
  reviewId,
  issues,
}: {
  items: FixItem[];
  repo: string;
  reviewId: string;
  issues: boolean;
}) {
  return (
    <section aria-labelledby="fix-list" className="rounded-panel border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="fix-list" className="text-[17px] font-bold">
            {L.heading}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-pretty text-text-subtle">{L.note}</p>
        </div>
        {items.length > 0 && (
          <CopyButton value={checklistMarkdown(items, repo)} label={L.heading} idle={L.copyAll} />
        )}
      </header>
      {items.length === 0 ? (
        <p className="flex items-start gap-3 px-5 py-4 text-[15px] leading-snug text-pretty text-text-muted">
          <CircleCheck
            aria-hidden
            size={18}
            strokeWidth={ICON}
            className="mt-0.5 shrink-0 text-gain"
          />
          {L.empty}
        </p>
      ) : (
        <ol>
          {items.map((item) => (
            <li key={item.id} className="border-b border-border px-5 py-4 last:border-0">
              <p className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[12px] font-medium",
                    SEVERITY[item.severity],
                  )}
                >
                  {L.severity[item.severity]}
                </span>
                <span className="font-mono text-[12px] text-text-subtle">
                  {L.effort[item.effort]}
                </span>
              </p>
              <p className="mt-2 text-[16px] leading-snug font-semibold text-pretty break-words">
                {item.title}
              </p>
              <p className="mt-1 text-[15px] leading-snug text-pretty text-text-muted">
                {item.fix}
              </p>
              {item.evidence.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {item.evidence.map((e, i) => (
                    <li key={i} className="min-w-0 font-mono text-[12px] text-text-subtle">
                      {e.href ? (
                        <a
                          href={e.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="break-all underline decoration-1 underline-offset-4 hover:text-text"
                        >
                          {e.label}
                        </a>
                      ) : (
                        <span className="break-words">{e.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton value={itemMarkdown(item)} label={item.title} idle={L.copyItem} />
                {issues && (
                  <a
                    href={issueUrl(item, repo, reviewId)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      buttonVariants({ variant: "secondary" }),
                      "h-10 gap-2 px-3 text-[14px]",
                    )}
                  >
                    <ExternalLink aria-hidden size={16} strokeWidth={ICON} />
                    {L.openIssue}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
