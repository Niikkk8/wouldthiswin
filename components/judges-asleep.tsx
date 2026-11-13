"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { JudgePortrait } from "@/components/judge-portrait";
import { buttonVariants } from "@/components/ui/button";
import { copy, fill } from "@/lib/copy";
import { untilReset } from "@/lib/limits";
import type { AsleepInfo } from "@/lib/start-session";

const A = copy.asleep;

function leftText(now: Date, reset: Date): string {
  const { hours, minutes } = untilReset(now, reset);
  if (hours > 0) return fill(A.left.hm, { h: hours, m: minutes });
  if (minutes > 0) return fill(A.left.m, { m: minutes });
  return A.left.soon;
}

/**
 * Shown in place of the form when a cap is hit: the Tired Judge, asleep, says so, with the
 * reset in the visitor's own time and somewhere useful to go meanwhile. Never an error page.
 */
export function JudgesAsleep({ info, className }: { info: AsleepInfo; className?: string }) {
  const reset = new Date(info.resetAt);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const time = reset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <section
      aria-labelledby="asleep"
      role="status"
      className={cn("flex max-w-[676px] flex-col gap-5 rounded-panel border border-border bg-surface p-5 sm:flex-row sm:p-6", className)}
    >
      <div className="w-[128px] shrink-0 overflow-hidden rounded-card border border-border">
        <JudgePortrait judge="tired" size={128} dozing label={false} />
      </div>
      <div className="min-w-0">
        <h2 id="asleep" className="text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
          {A.title}
        </h2>
        <p className="mt-2 text-[17px] leading-snug">
          <span className="label-mono mr-2 uppercase">{copy.judges.tired.name}</span>
          {A.line[info.reason]}
        </p>
        <p className="mt-3 font-mono text-[14px] text-text-muted tabular-nums">
          {fill(A.reset, { time, left: leftText(now, reset) })}
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {info.lastReview && (
            <Link href={`/s/${info.lastReview.id}`} className={buttonVariants({ className: "w-full sm:w-auto" })}>
              {A.shareLast}
            </Link>
          )}
          <Link
            href="/guides"
            className={buttonVariants({ variant: info.lastReview ? "secondary" : "primary", className: "w-full sm:w-auto" })}
          >
            {A.guides}
          </Link>
        </div>
      </div>
    </section>
  );
}
