"use client";

import { copy, fill } from "@/lib/copy";
import { SKIP_DELTA } from "@/lib/odds";

const L = copy.acts.grilling.lifeline;
const S = copy.acts.grilling.skip;

/** The session's one lifeline: 30 more seconds for 2 points. Gone once pulled, on any question. */
export function LifelineButton({ onUse, disabled }: { onUse: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onUse}
      disabled={disabled}
      aria-label={L.label}
      title={L.label}
      className="inline-flex h-11 min-w-11 items-center justify-center rounded-control border border-border-strong px-3 font-mono text-[14px] text-text-muted transition-colors duration-150 hover:text-text disabled:opacity-50"
    >
      {L.button}
    </button>
  );
}

/** What the Tired Judge says when the lifeline is pulled. */
export function LifelineLine() {
  return (
    <p className="text-[15px] leading-snug text-text-muted" role="status">
      <span className="label-mono mr-2 uppercase">{copy.judges.tired.name}</span>
      {L.used}
    </p>
  );
}

/** "Skip this one": a fixed small cost, and the Tired Judge moves things along. Better than leaving. */
export function SkipButton({ onSkip, disabled }: { onSkip: () => void; disabled: boolean }) {
  const label = fill(S.label, { points: -SKIP_DELTA });
  return (
    <button
      type="button"
      onClick={onSkip}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-11 items-center justify-center px-1 font-mono text-[14px] text-text-muted underline-offset-4 transition-colors duration-150 hover:text-text hover:underline disabled:opacity-50"
    >
      {S.button}
    </button>
  );
}
