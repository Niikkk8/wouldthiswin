"use client";

import { copy } from "@/lib/copy";
import type { SessionView } from "@/lib/session";
import { ActTitle } from "./act-parts";

/** The share screen. Placeholder: the cards, the board opt-in and Versus come later. */
export function ShareAct({ view }: { view: SessionView }) {
  const v = view.verdict;
  return (
    <>
      <ActTitle eyebrow={copy.acts.share.eyebrow} title={copy.acts.share.title} />
      {v && (
        <p className="mt-8 text-[22px] text-text-muted">
          {v.odds}% · {copy.tiers[v.tier]}
        </p>
      )}
    </>
  );
}
