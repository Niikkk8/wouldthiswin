"use client";

import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import type { Criterion } from "@/lib/rubric";

// The fixed-rule judging sheet, shown for reviews written before the panel scored a rubric.

const JUDGE_OF: Partial<Record<Criterion["key"], keyof typeof copy.judges>> = {
  impact: "investor",
  pitch: "tired",
  defense: "engineer",
};

/** The judging sheet: 1 to 5 per criterion, each with the rule it came from. */
export function JudgingSheet({ sheet }: { sheet: Criterion[] }) {
  const s = copy.review.sheet;
  return (
    <section aria-labelledby="sheet" className="rounded-panel border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <h2 id="sheet" className="text-[17px] font-bold">
          {s.heading}
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-text-subtle text-pretty">{s.note}</p>
      </header>
      <ul>
        {sheet.map((c) => {
          const judge = JUDGE_OF[c.key];
          const basis = fill(s.basis[c.basis], {
            ...(c.values ?? {}),
            ...(judge ? { judge: copy.judges[judge].name } : {}),
          });
          return (
            <li
              key={c.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-border px-5 py-3.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-[16px] leading-snug font-semibold">{s.criteria[c.key]}</p>
                <p className="mt-0.5 text-[14px] leading-snug text-text-subtle">{basis}</p>
              </div>
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-2 w-4 rounded-full",
                        i < c.score ? (c.score >= 4 ? "bg-gain" : c.score === 3 ? "bg-unclear" : "bg-loss") : "bg-border-strong",
                      )}
                    />
                  ))}
                </span>
                <span className="w-8 text-right font-mono text-[14px] tabular-nums">
                  <span className="sr-only">{fill(s.score, { n: c.score })}</span>
                  <span aria-hidden>{c.score}/5</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

