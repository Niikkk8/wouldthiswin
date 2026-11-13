"use client";

import { copy } from "@/lib/copy";

const L = copy.acts.grilling.lifeline;

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
