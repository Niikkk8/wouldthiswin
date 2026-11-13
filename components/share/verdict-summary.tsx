import { cn } from "cn";
import { StatusPill, projectName } from "@/components/review/review-parts";
import { Avatar } from "@/components/session/deliberation-act";
import { copy, fill } from "@/lib/copy";
import { CRITERION_MAX } from "@/lib/rubric";
import { REVIEW_ORDER, type Review } from "@/lib/review";

const V = copy.verdict;

const tone = (score: number) => (score >= 7 ? "bg-gain" : score >= 4 ? "bg-unclear" : "bg-loss");

/** What a judge says on the public verdict: their review comment, or their status if they left none. */
export function judgeLine(r: Review, judge: (typeof REVIEW_ORDER)[number]): string {
  const comment = r.comments.find((c) => c.judge === judge);
  if (comment) return comment.body;
  const status = r.reviewers.find((x) => x.judge === judge)?.status ?? "commented";
  return copy.review.reviewerStatus[status];
}

/**
 * The shareable verdict, as it reads to anyone: odds, status, the rubric's scores and one line
 * per judge. Built only from the public review, so nothing private or from the transcript.
 */
export function VerdictSummary({ review: r, delta }: { review: Review; delta?: React.ReactNode }) {
  return (
    <article className="pt-6 lg:pt-4">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
        <div className="min-w-0">
          <p className="label-mono uppercase">{V.eyebrow}</p>
          <p className="mt-2 font-mono text-[14px] break-all text-text-muted">{r.repo}</p>
          <h1 className="mt-2 text-[36px] leading-none font-black tracking-[-0.04em] break-words lg:text-act">{projectName(r.repo)}</h1>
          <StatusPill ready={r.readyToWin} className="mt-5" />
        </div>
        <div className="lg:text-right">
          <p className="label-mono uppercase">{copy.review.finalOdds}</p>
          <p className="mt-1 text-[72px] leading-[0.9] font-black tracking-[-0.05em] lg:text-odds-lg">{r.odds}%</p>
          <p className="mt-2 text-[20px] font-extrabold tracking-[-0.02em]">{copy.tiers[r.tier]}</p>
          {delta}
        </div>
      </header>

      <p className="mt-8 max-w-[880px] text-[20px] leading-snug text-text-muted lg:mt-10 lg:text-[24px]">
        {copy.review.remember} <span className="font-bold text-text">&ldquo;{r.oneLiner}&rdquo;</span>
      </p>

      <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-2 lg:gap-14">
        <section aria-labelledby="judges">
          <h2 id="judges" className="label-mono uppercase">
            {V.judges}
          </h2>
          <ul className="mt-4 grid gap-5 border-t border-border pt-5">
            {REVIEW_ORDER.map((judge) => (
              <li key={judge} className="flex items-start gap-3">
                <Avatar judge={judge} />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold">{copy.judges[judge].name}</p>
                  <p className="mt-0.5 text-[16px] leading-snug text-pretty text-text-muted">{judgeLine(r, judge)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {r.rubric && (
          <section aria-labelledby="scores">
            <h2 id="scores" className="label-mono uppercase">
              {fill(V.scores, { n: r.rubric.aggregate })}
            </h2>
            <ul className="mt-4 grid gap-3 border-t border-border pt-5">
              {r.rubric.criteria.map((c) => (
                <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                  <span className="min-w-0 text-[16px] font-semibold">{c.name}</span>
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-border-strong">
                      <span className={cn("block h-full origin-left rounded-full", tone(c.score))} style={{ transform: `scaleX(${c.score / CRITERION_MAX})` }} />
                    </span>
                    <span className="w-11 text-right font-mono text-[14px] tabular-nums">
                      <span className="sr-only">{fill(copy.review.rubric.score, { n: c.score })}</span>
                      <span aria-hidden>{c.score}/10</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
