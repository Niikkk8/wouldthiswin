"use client";

import { useEffect } from "react";
import { cn } from "cn";
import { copy } from "@/lib/copy";
import { toneOf } from "@/lib/odds";
import type { SessionView } from "@/lib/session";
import { ActFooter, ActTitle } from "./act-parts";

const STEP_MS = 900;

const CARD = {
  backed: "border-text",
  unbacked: "border-loss bg-loss/10",
  unclear: "border-dashed border-unclear",
} as const;

const NOTE = { gain: "text-text", loss: "text-loss", unclear: "text-unclear", flat: "text-text-muted" };
const DELTA = { gain: "text-gain", loss: "text-loss", unclear: "text-unclear", flat: "text-text-muted" };

/**
 * Act 1, the scan. Claims resolve one at a time, each moving the odds.
 * Placeholder layout: the file tree and the beams come next.
 */
export function ScanAct({
  view,
  revealed,
  onReveal,
  onNext,
  pending,
}: {
  view: SessionView;
  revealed: number;
  onReveal: (n: number) => void;
  onNext: () => void;
  pending: boolean;
}) {
  const claims = view.claims ?? [];
  const done = revealed >= claims.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => onReveal(revealed + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [done, revealed, onReveal]);

  return (
    <>
      <ActTitle eyebrow={copy.acts.scan.eyebrow} title={copy.acts.scan.title} />
      <p className="label-mono mt-12 uppercase">{copy.acts.scan.claims}</p>
      <ul className="mt-4 grid max-w-[444px] gap-6">
        {claims.map((c, i) => {
          const shown = i < revealed;
          // Scan events are one per claim, in order.
          const delta = view.events[i]?.delta ?? 0;
          const tone = toneOf({ delta, status: c.status });
          return (
            <li
              key={i}
              className={cn(
                "rounded-card border px-5 py-5 transition-[opacity,border-color] duration-300",
                shown ? CARD[c.status] : "border-border opacity-60",
              )}
            >
              <p className="text-[18px] font-bold">{c.claim}</p>
              <p className={cn("mt-2 font-mono text-[13px]", shown ? NOTE[tone] : "invisible")}>
                {c.evidence}
                <span className={cn("ml-3", c.status === "backed" ? DELTA[tone] : "")}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
      {!done && (
        <button
          type="button"
          onClick={() => onReveal(claims.length)}
          className="label-mono mt-6 underline underline-offset-4 hover:text-text"
        >
          {copy.acts.scan.skip}
        </button>
      )}
      {done && <ActFooter label={copy.acts.scan.next} onClick={onNext} disabled={pending} />}
    </>
  );
}
