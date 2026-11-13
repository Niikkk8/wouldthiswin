"use client";

import { Circle, CircleCheck, CircleDot } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import type { FixStatus } from "@/lib/odds";
import type { Iteration } from "@/lib/recheck";
import { reviewPath } from "@/lib/site";
import { ICON } from "./review-parts";

const FIX: Record<FixStatus, { Icon: typeof CircleCheck; color: string }> = {
  addressed: { Icon: CircleCheck, color: "text-gain" },
  partly: { Icon: CircleDot, color: "text-unclear" },
  untouched: { Icon: Circle, color: "text-text-subtle" },
};

const plural = (n: number) => (n === 1 ? "" : "s");

/** A re-review's headline: what the panel asked for last round, and what the diff shows. */
export function SinceLast({ it }: { it: Iteration }) {
  const c = copy.iteration;
  return (
    <section aria-labelledby="since" className="rounded-panel border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4">
        <h2 id="since" className="flex items-baseline gap-3 text-[17px] font-bold">
          {c.heading}
          {it.round && <span className="font-mono text-[12px] font-medium text-gain uppercase">{fill(c.round, { n: it.round })}</span>}
        </h2>
        <Link
          href={reviewPath(it.previousId)}
          className="font-mono text-[13px] text-text-muted underline decoration-1 underline-offset-4 transition-colors hover:text-text"
        >
          {c.previous}
        </Link>
      </header>
      <p className="label-mono border-b border-border px-5 py-3 tabular-nums">
        {fill(c.summary, {
          commits: it.commits,
          cs: plural(it.commits),
          files: it.filesChanged,
          fs: plural(it.filesChanged),
          odds: it.previousOdds,
        })}
      </p>
      <ul>
        {it.fixes.map((f, i) => {
          const { Icon, color } = FIX[f.status];
          return (
            <li key={i} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 border-b border-border px-5 py-3.5 last:border-0">
              <Icon aria-hidden size={18} strokeWidth={ICON} className={cn("mt-0.5", color)} />
              <div className="min-w-0">
                <p className="text-[16px] leading-snug font-semibold text-pretty">
                  <span className={cn("mr-2 font-mono text-[12px] font-medium uppercase", color)}>{c.status[f.status]}</span>
                  {f.fix}
                </p>
                <p className="mt-0.5 text-[14px] leading-snug text-text-subtle">{f.note}</p>
                {f.file && f.quote && (
                  <div className="mt-2 overflow-x-auto rounded-control bg-bg px-3 py-2 font-mono text-[12px] text-text-muted">
                    <p className="text-text-subtle">{f.file}</p>
                    <p className="whitespace-pre">
                      <span aria-hidden className="text-gain">+ </span>
                      {f.quote}
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

