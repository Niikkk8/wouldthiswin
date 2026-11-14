import { ArrowRight, CircleCheck, CircleDashed } from "lucide-react";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import type { RejudgeDelta } from "@/lib/rejudge";
import { ICON } from "./review-parts";

const D = copy.rejudge;

/** "34% → 61%", in the odds' own colours. */
export function OddsDelta({
  from,
  to,
  className,
}: {
  from: number;
  to: number;
  className?: string;
}) {
  const up = to > from;
  return (
    <p className={cn("flex items-center gap-2 font-mono tabular-nums", className)}>
      <span className="sr-only">{fill(D.oddsLabel, { from, to })}</span>
      <span aria-hidden className="text-text-subtle">
        {from}%
      </span>
      <ArrowRight aria-hidden size={16} strokeWidth={ICON} className="text-text-subtle" />
      <span aria-hidden className={to === from ? "text-text" : up ? "text-gain" : "text-loss"}>
        {to}%
      </span>
    </p>
  );
}

/** What changed since the round before: the odds, the fix items that are gone, the scores that moved. */
export function RejudgeSummary({ delta }: { delta: RejudgeDelta }) {
  return (
    <div className="grid gap-4 border-b border-border px-5 py-4">
      <OddsDelta from={delta.from} to={delta.to} className="text-[20px]" />
      {(delta.resolved.length > 0 || delta.open.length > 0) && (
        <div>
          <h3 className="label-mono uppercase">{D.fixItems}</h3>
          <ul className="mt-2 grid gap-1.5">
            {delta.resolved.map((t) => (
              <li key={`r-${t}`} className="flex items-start gap-2 text-[15px] leading-snug">
                <CircleCheck
                  aria-hidden
                  size={16}
                  strokeWidth={ICON}
                  className="mt-0.5 shrink-0 text-gain"
                />
                <span>
                  <span className="sr-only">{D.resolved}: </span>
                  {t}
                </span>
              </li>
            ))}
            {delta.open.map((t) => (
              <li
                key={`o-${t}`}
                className="flex items-start gap-2 text-[15px] leading-snug text-text-muted"
              >
                <CircleDashed
                  aria-hidden
                  size={16}
                  strokeWidth={ICON}
                  className="mt-0.5 shrink-0 text-text-subtle"
                />
                <span>
                  <span className="sr-only">{D.open}: </span>
                  {t}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {delta.moved.length > 0 && (
        <div>
          <h3 className="label-mono uppercase">{D.moved}</h3>
          <ul className="mt-2 grid gap-1">
            {delta.moved.map((m) => (
              <li key={m.key} className="flex items-baseline justify-between gap-4 text-[15px]">
                <span className="min-w-0">{m.name}</span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[14px] tabular-nums",
                    m.to > m.from ? "text-gain" : "text-loss",
                  )}
                >
                  {m.from} → {m.to}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
