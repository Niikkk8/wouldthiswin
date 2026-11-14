"use client";

import { GrillingProgress } from "@/components/grilling/progress";
import { FixList } from "@/components/review/fix-list";
import { copy, fill } from "@/lib/copy";
import { SKIP_DELTA } from "@/lib/odds";
import { QUESTION_COUNT, grillingProgress, type SessionView } from "@/lib/session";
import { ActionBar } from "./action-bar";

const R = copy.acts.resume;
const C = copy.acts.closed;

/** A session is coming back part way: scanned but not grilled, or left between or during questions. */
export function isReturning(v: SessionView): boolean {
  if (v.closed) return false;
  if (v.act === "scan") return v.claims !== null;
  if (v.act !== "grilling") return false;
  // A question still on the clock carries on as it is: no offer in its way.
  const running = v.questions.some((q) => !q.answer) && !v.away;
  return !running;
}

/** What the scan found that has a fix, kept on the page whether they go on or not. */
function ScanFixes({ view }: { view: SessionView }) {
  const items = view.scanFixes ?? [];
  if (!items.length)
    return (
      <p className="mt-10 text-[16px] text-text-muted">
        {view.claims === null ? C.noScan : C.noFixes}
      </p>
    );
  return (
    <div className="mt-10">
      <FixList items={items} repo={view.repo} reviewId={view.id} issues />
    </div>
  );
}

/**
 * Welcome back: where they left off, what continuing means for the clock, and the scan's
 * fix list underneath in case they'd rather just take that.
 */
export function ResumeOffer({
  view,
  onContinue,
  pending,
}: {
  view: SessionView;
  onContinue: () => void;
  pending: boolean;
}) {
  const answered = view.questions.filter((q) => q.answer).length;
  const p = grillingProgress(view.questions, answered);
  const allAnswered = view.act === "grilling" && answered >= view.questionCount;
  let title: string;
  let body: string;
  if (view.act === "scan") {
    title = fill(R.scanTitle, { n: QUESTION_COUNT });
    body = R.scanBody;
  } else if (allAnswered) {
    title = fill(R.doneTitle, { total: p.total });
    body = R.doneBody;
  } else {
    title = fill(R.grillingTitle, { i: p.number, total: p.total });
    body = view.away ? fill(R.awayBody, { points: -SKIP_DELTA }) : R.betweenBody;
  }
  const behind = view.questions.filter((q, i) => i < answered && !q.followUp).length;
  return (
    <>
      <section
        aria-labelledby="resume-heading"
        className="max-w-[720px] lg:max-w-[calc(100%-360px)]"
      >
        <p className="label-mono uppercase">{R.eyebrow}</p>
        <h1
          id="resume-heading"
          className="mt-3 text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance lg:text-[44px]"
        >
          {title}
        </h1>
        <p className="mt-4 text-[18px] leading-snug text-pretty text-text-muted">{body}</p>
        <GrillingProgress
          number={view.act === "scan" ? 0 : allAnswered ? p.total : p.number}
          total={p.total}
          done={allAnswered ? p.total : behind}
          className="mt-6"
        />
        <p className="mt-4 text-[14px] text-text-subtle">{R.window}</p>
      </section>
      <h2 className="label-mono mt-12 uppercase">{R.fixesHeading}</h2>
      <ScanFixes view={view} />
      <ActionBar label={R.next} ready pending={pending} onNext={onContinue} />
    </>
  );
}

/** Past the 24 hours: the grilling can't go on, and the scan's findings stay. */
export function ClosedSession({ view }: { view: SessionView }) {
  return (
    <>
      <section
        aria-labelledby="closed-heading"
        className="max-w-[720px] lg:max-w-[calc(100%-360px)]"
      >
        <p className="label-mono uppercase">{C.eyebrow}</p>
        <h1
          id="closed-heading"
          className="mt-3 text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance lg:text-[44px]"
        >
          {C.title}
        </h1>
        <p className="mt-4 text-[18px] leading-snug text-pretty text-text-muted">{C.body}</p>
      </section>
      <ScanFixes view={view} />
      <ActionBar label={C.again} ready href="/" />
    </>
  );
}
