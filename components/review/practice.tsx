import { copy } from "@/lib/copy";
import type { Review } from "@/lib/review";

const P = copy.review.practice;

/** After the verdict, never during the grilling: each question and what a strong answer would have covered. Owner only. */
export function Practice({ items }: { items: Review["practice"] }) {
  return (
    <section aria-labelledby="practice" className="rounded-panel border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <h2 id="practice" className="text-[17px] font-bold">
          {P.heading}
        </h2>
        <p className="mt-1 text-[14px] text-text-subtle">{P.note}</p>
      </header>
      <ol>
        {items.map((it, i) => (
          <li key={i} className="border-b border-border px-5 py-4 last:border-0">
            <p className="label-mono uppercase">{copy.judges[it.judge].name}</p>
            <p className="mt-1 text-[16px] leading-snug font-semibold text-pretty">{it.question}</p>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-[15px] leading-snug text-text-muted marker:text-text-subtle">
              {it.points.map((p, j) => (
                <li key={j}>{p}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
