"use client";

import { useEffect, useRef } from "react";
import { ReReview } from "@/components/review/re-review";
import { ReviewView } from "@/components/review/review-view";
import { burst } from "@/components/ui/confetti";
import { copy } from "@/lib/copy";
import type { SessionView } from "@/lib/session";
import { ActionBar } from "./action-bar";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** Act 4, the review. One small confetti burst for Winner or Ready to win. */
export function VerdictAct({
  view,
  onNext,
  pending,
  demo = false,
}: {
  view: SessionView;
  onNext: () => void;
  pending: boolean;
  demo?: boolean;
}) {
  const reduce = useReducedMotion();
  const review = view.review;
  const fired = useRef(false);
  const celebrate = !!review && (review.readyToWin || review.tier === "winner");

  useEffect(() => {
    if (!celebrate || reduce || fired.current) return;
    fired.current = true;
    const t = setTimeout(() => burst({ x: 0.8, y: 0.25 }), 500);
    return () => clearTimeout(t);
  }, [celebrate, reduce]);

  if (!review) return null;
  return (
    <>
      <ReviewView review={review} />
      {!demo && <ReReview id={review.id} repo={review.repo} className="mt-12" />}
      <ActionBar label={copy.acts.verdict.next} ready pending={pending} onNext={onNext} />
    </>
  );
}
