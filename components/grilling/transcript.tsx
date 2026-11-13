"use client";

import { motion } from "motion/react";
import { cn } from "cn";
import { signed } from "@/components/odds-widget";
import { copy } from "@/lib/copy";
import type { QuestionView } from "@/lib/session";

export const answerId = (i: number) => `answer-${i}`;

/** Earlier answers, each collapsed to one faded line. The one just given flies in from the field. */
export function Transcript({ questions }: { questions: QuestionView[] }) {
  const lines = questions.filter((q) => q.answer);
  if (!lines.length) return null;
  return (
    <ol className="grid gap-1.5 pt-6 text-[15px] leading-snug lg:max-w-[calc(100%-360px)] lg:pt-4 lg:text-[16px]">
      {lines.map((q, i) => {
        const a = q.answer!;
        return (
          <li key={i} className="flex min-w-0 items-baseline gap-3 text-text-subtle" title={q.text}>
            <span className="label-mono shrink-0 uppercase">{copy.judges[q.judge].name}</span>
            <motion.span layoutId={answerId(i)} className="block min-w-0 truncate text-text-muted/80">
              {a.silent ? copy.acts.grilling.silence : a.text}
            </motion.span>
            {a.score !== null && (
              <span
                className={cn(
                  "shrink-0 font-mono text-[13px]",
                  a.score > 0 ? "text-gain" : a.score < 0 ? "text-loss" : "text-text-subtle",
                )}
              >
                {signed(a.score)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

