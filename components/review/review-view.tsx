"use client";

import { CircleAlert, CircleCheck, CircleX, MessageSquare } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "cn";
import { Avatar } from "@/components/session/deliberation-act";
import { Checkbox } from "@/components/ui/checkbox";
import { copy, fill } from "@/lib/copy";
import { summaryLine, type CheckStatus, type Review } from "@/lib/review";
import type { ReviewStatus } from "@/lib/session";
import { fixItems } from "@/lib/fix-list";
import { FixList } from "./fix-list";
import { JudgingSheet } from "./judging-sheet";
import { ICON, Lines, Rise, StatusPill, Still, projectName } from "./review-parts";
import { RubricBreakdown } from "./rubric-breakdown";
import { SinceLast } from "./since-last";

export { StatusPill };

const CHECK: Record<CheckStatus, { Icon: typeof CircleCheck; color: string }> = {
  passed: { Icon: CircleCheck, color: "text-gain" },
  failed: { Icon: CircleX, color: "text-loss" },
  warning: { Icon: CircleAlert, color: "text-unclear" },
};

const REVIEWER: Record<ReviewStatus, { Icon: typeof CircleCheck; color: string }> = {
  approved: { Icon: CircleCheck, color: "text-gain" },
  changesRequested: { Icon: CircleX, color: "text-loss" },
  commented: { Icon: MessageSquare, color: "text-text-muted" },
};

function Fixes({ fixes }: { fixes: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => fixes.map(() => false));
  const id = useId();
  return (
    <ul className="mt-4 grid gap-3">
      {fixes.map((f, i) => (
        <li key={i} className="flex items-start gap-3">
          <Checkbox
            id={`${id}-${i}`}
            checked={done[i]}
            onCheckedChange={(v) => setDone((d) => d.map((x, j) => (j === i ? v === true : x)))}
            className="mt-1"
          />
          <label htmlFor={`${id}-${i}`} className={cn("text-[17px] leading-snug", done[i] && "text-text-subtle line-through")}>
            {f}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Act 4, and the public review link: the night as a pull-request review. */
export function ReviewView({
  review,
  still = false,
  fixList,
}: {
  review: Review;
  still?: boolean;
  /** The owner's fix list: "full" with GitHub issue links, "sample" without (the sample repo isn't real). */
  fixList?: "full" | "sample";
}) {
  const r = review;
  return (
    <Still.Provider value={still}>
    <article className="pt-6 lg:pt-4">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
        <Rise>
          <p className="label-mono uppercase">{copy.review.eyebrow}</p>
          <p className="mt-2 font-mono text-[14px] text-text-muted">{r.repo}</p>
          <h1 className="mt-2 text-[36px] leading-none font-black tracking-[-0.04em] break-words lg:text-act">
            {projectName(r.repo)}
          </h1>
          <StatusPill ready={r.readyToWin} className="mt-5" />
        </Rise>
        <Rise delay={0.12} className="lg:text-right">
          <p className="label-mono uppercase">{copy.review.finalOdds}</p>
          <p className="mt-1 text-[72px] leading-[0.9] font-black tracking-[-0.05em] lg:text-odds-lg">{r.odds}%</p>
          <p className="mt-2 text-[20px] font-extrabold tracking-[-0.02em]">{copy.tiers[r.tier]}</p>
        </Rise>
      </header>

      <Rise delay={0.2}>
        <p className="mt-8 max-w-[880px] text-[20px] leading-snug text-text-muted lg:mt-10 lg:text-[24px]">
          {copy.review.remember} <span className="font-bold text-text">&ldquo;{r.oneLiner}&rdquo;</span>
        </p>
      </Rise>

      <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
        <Rise delay={0.28} className="lg:col-start-2 lg:row-start-1">
          <aside aria-labelledby="reviewers">
            <h2 id="reviewers" className="label-mono uppercase">
              {copy.review.reviewers}
            </h2>
            <ul className="mt-4 grid gap-3 border-t border-border pt-4">
              {r.reviewers.map((rv) => {
                const { Icon, color } = REVIEWER[rv.status];
                return (
                  <li key={rv.judge} className="flex items-center gap-3">
                    <Avatar judge={rv.judge} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold">{copy.judges[rv.judge].name}</p>
                      <p className={cn("flex items-center gap-1.5 font-mono text-[13px]", color)}>
                        <Icon aria-hidden size={14} strokeWidth={ICON} />
                        {copy.review.reviewerStatus[rv.status]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        </Rise>

        <div className="grid min-w-0 gap-12 lg:col-start-1 lg:row-start-1">
          {r.iteration && (
            <Rise delay={0.3}>
              <SinceLast it={r.iteration} />
            </Rise>
          )}
          <Rise delay={0.34}>
            <section aria-labelledby="checks" className="rounded-panel border border-border bg-surface">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
                <h2 id="checks" className="text-[17px] font-bold">
                  {copy.review.checks.heading}
                </h2>
                <p className="label-mono">{summaryLine(r.summary)}</p>
              </header>
              <ul>
                {r.checks.map((c, i) => {
                  const { Icon, color } = CHECK[c.status];
                  return (
                    <li
                      key={i}
                      className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border px-5 py-3.5 last:border-0 sm:grid-cols-[20px_minmax(0,1fr)_auto]"
                    >
                      <Icon aria-hidden size={18} strokeWidth={ICON} className={cn("mt-0.5", color)} />
                      <div className="min-w-0">
                        <p className="text-[16px] leading-snug font-semibold">
                          <span className="sr-only">{copy.review.status[c.status]}: </span>
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-[14px] leading-snug text-text-subtle">{c.detail}</p>
                      </div>
                      {c.file && (
                        <p className="col-start-2 truncate font-mono text-[12px] text-text-subtle sm:col-start-3 sm:max-w-[220px] sm:self-center">
                          {c.file}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </Rise>

          {r.rubric ? (
            <Rise delay={0.37}>
              <RubricBreakdown rubric={r.rubric} findings={r.findings} repo={r.repo} commit={r.commit} />
            </Rise>
          ) : (
            r.sheet && (
              <Rise delay={0.37}>
                <JudgingSheet sheet={r.sheet} />
              </Rise>
            )
          )}

          <Rise delay={0.4}>
            <section aria-labelledby="comments">
              <h2 id="comments" className="label-mono uppercase">
                {copy.review.comments}
              </h2>
              {r.comments.length === 0 && <p className="mt-4 text-text-muted">{copy.review.noComments}</p>}
              <ul className="mt-4 grid gap-6">
                {r.comments.map((c) => {
                  const n = c.excerpt.split("\n").length;
                  const where =
                    n === 1
                      ? fill(copy.review.line, { n: c.startLine })
                      : fill(copy.review.lines, { from: c.startLine, to: c.startLine + n - 1 });
                  const status = r.reviewers.find((x) => x.judge === c.judge)?.status ?? "commented";
                  return (
                    <li key={c.judge} className="overflow-hidden rounded-card border border-border bg-surface">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 font-mono text-[12px] text-text-muted">
                        <span className="min-w-0 truncate">{c.file}</span>
                        <span className="text-text-subtle">{where}</span>
                      </p>
                      <Lines start={c.startLine} excerpt={c.excerpt} />
                      <div className="flex items-start gap-3 border-t border-border px-4 py-4">
                        <Avatar judge={c.judge} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                            <span className="font-bold">{copy.judges[c.judge].name}</span>
                            <span className={cn("font-mono text-[12px]", REVIEWER[status].color)}>
                              {copy.review.reviewerStatus[status]}
                            </span>
                          </p>
                          <p className="mt-1 text-[16px] leading-snug">{c.body}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </Rise>

          {fixList && (
            <Rise delay={0.43}>
              <FixList items={fixItems(r.findings, r.repo, r.commit)} repo={r.repo} reviewId={r.id} issues={fixList === "full"} />
            </Rise>
          )}

          <Rise delay={0.46}>
            <section aria-labelledby="fixes">
              <h2 id="fixes" className="label-mono uppercase">
                {fixList ? copy.fixList.panelNotes : copy.review.fixes}
              </h2>
              <Fixes fixes={r.fixes} />
              <p className="label-mono mt-4">{copy.review.fixesNote}</p>
            </section>
          </Rise>
        </div>
      </div>
    </article>
    </Still.Provider>
  );
}
