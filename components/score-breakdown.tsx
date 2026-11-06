import { copy } from "@/lib/copy";
import type { Judgment } from "@/lib/judge";

const CRITERIA = ["demo", "problem", "execution", "wow", "pitch"] as const;

/** The five scores, written on the whiteboard in marker. Low scores get the red marker. */
export function ScoreBreakdown({ scores }: { scores: Judgment["scores"] }) {
  return (
    <dl className="max-w-xs font-hand text-2xl font-bold leading-none sm:text-[1.625rem]">
      {CRITERIA.map((key) => {
        const score = scores[key];
        return (
          <div key={key} className="flex items-baseline justify-between gap-6 py-2">
            <dt>{copy.scoreLabels[key]}</dt>
            <dd className={score <= 4 ? "text-marker-red" : undefined}>
              {score}
              <span className="ml-1 font-sans text-base font-semibold text-graphite">/10</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
