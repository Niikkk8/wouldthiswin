"use client";

import { motion, useReducedMotion } from "motion/react";
import { copy, fill } from "@/lib/copy";
import type { SessionView } from "@/lib/session";
import { Button } from "@/components/ui/button";

const projectName = (repo: string) => repo.split("/").pop() ?? repo;

/** Act 4, the verdict. Placeholder paper: findings, exhibits and the stamp come later. */
export function VerdictAct({
  view,
  onNext,
  pending,
}: {
  view: SessionView;
  onNext: () => void;
  pending: boolean;
}) {
  const reduce = useReducedMotion();
  const v = view.verdict;
  if (!v) return null;
  return (
    <div className="flex flex-col items-center pt-4">
      <motion.article
        className="w-full max-w-[984px] bg-paper px-6 py-10 font-paper text-paper-ink lg:px-12 lg:py-12"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 200, damping: 22 }}
      >
        <p className="text-center text-[13px] tracking-[0.3em] uppercase">{copy.acts.verdict.matter}</p>
        <h1 className="mt-2 text-center font-sans text-[32px] leading-none font-black tracking-[-0.04em] lg:text-[44px]">
          {fill(copy.acts.verdict.caption, { name: projectName(view.repo) })}
        </h1>
        <hr className="mt-6 border-paper-ink" />
        <p className="mt-6 text-[13px] tracking-[0.2em] uppercase">{copy.acts.verdict.finalOdds}</p>
        <p className="mt-2 font-sans text-[72px] leading-[0.9] font-black tracking-[-0.05em] lg:text-odds-lg">
          {v.odds}%
        </p>
        <p className="mt-3 font-sans text-[24px] font-extrabold tracking-[-0.02em]">{copy.tiers[v.tier]}</p>
        {view.panel && (
          <p className="mt-3 max-w-sm text-[15px]">
            {fill(copy.acts.verdict.remember, { oneLiner: view.panel.oneLiner })}
          </p>
        )}
        <hr className="mt-10 border-paper-ink" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <div>
            <p className="w-fit border-4 border-stamp px-4 py-1 font-sans text-[36px] font-black tracking-[-0.02em] text-stamp uppercase">
              {v.charge ? copy.acts.verdict.guilty : copy.acts.verdict.notGuilty}
            </p>
            {v.charge && <p className="mt-2 font-bold">{v.charge}</p>}
          </div>
          {view.panel && (
            <div>
              <p className="text-[13px] tracking-[0.2em] uppercase">{copy.acts.verdict.sentence}</p>
              <ol className="mt-2 grid gap-1.5 text-[15px]">
                {view.panel.fixes.map((f, i) => (
                  <li key={i}>
                    <b>{i + 1}.</b> {f}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </motion.article>
      <Button variant="link" className="mt-10 font-bold" onClick={onNext} disabled={pending}>
        {copy.acts.verdict.next}
      </Button>
    </div>
  );
}
