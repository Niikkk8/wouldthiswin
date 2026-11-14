"use client";

import { GitPullRequestArrow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { JudgesAsleep } from "@/components/judges-asleep";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { startSession, type AsleepInfo } from "@/lib/start-session";

/**
 * After the review, the owner can push fixes and ask the panel to look again: the panel
 * checks each fix it asked for against what changed. Errors (nothing new pushed, the daily
 * limit) show inline, next to the button, with what to do next.
 */
export function ReReview({
  id,
  repo,
  className,
}: {
  id: string;
  repo: string;
  className?: string;
}) {
  const c = copy.iteration.again;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asleep, setAsleep] = useState<AsleepInfo | null>(null);

  async function ask() {
    if (pending) return;
    setPending(true);
    setError(null);
    const r = await startSession({ repoUrl: `https://github.com/${repo}`, previousId: id });
    if (r.kind === "started") return router.push(`/s/${r.id}`);
    setPending(false);
    if (r.kind === "asleep") setAsleep(r.asleep);
    else setError(r.message);
  }

  if (asleep) return <JudgesAsleep info={asleep} className={className} />;

  return (
    <section
      aria-labelledby="re-review"
      className={cn("rounded-panel border border-border bg-surface px-5 py-5 sm:px-6", className)}
    >
      <div className="flex items-start gap-3">
        <GitPullRequestArrow
          aria-hidden
          size={20}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-gain"
        />
        <div className="min-w-0">
          <h2 id="re-review" className="text-[17px] font-bold text-balance">
            {c.heading}
          </h2>
          <p className="mt-1 max-w-[620px] text-[15px] leading-snug text-text-muted text-pretty">
            {c.body}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={ask}
          disabled={pending}
          aria-describedby={error ? "re-review-error" : undefined}
          className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:w-auto")}
        >
          {pending ? c.busy : c.button}
        </button>
        <p
          id="re-review-error"
          aria-live="polite"
          className="text-[14px] leading-snug text-loss empty:hidden"
        >
          {error}
        </p>
      </div>
    </section>
  );
}
