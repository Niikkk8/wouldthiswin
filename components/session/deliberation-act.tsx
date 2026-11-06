"use client";

import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import { toneOf } from "@/lib/odds";
import type { SessionView } from "@/lib/session";
import { ActFooter, ActTitle } from "./act-parts";

const AVATAR = {
  engineer: "bg-[#1f3a2e] text-[#7fd1a8]",
  investor: "bg-[#3a3214] text-[#f5d36a]",
  tired: "bg-[#2a2547] text-[#b8adff]",
} as const;

const DELTA = { gain: "text-gain", loss: "text-loss", unclear: "text-unclear", flat: "text-text-muted" };

const projectName = (repo: string) => repo.split("/").pop() ?? repo;

/** Act 3, deliberation. Placeholder motion: the typing indicator and replay chart come later. */
export function DeliberationAct({
  view,
  onNext,
  pending,
}: {
  view: SessionView;
  onNext: () => void;
  pending: boolean;
}) {
  return (
    <>
      <ActTitle eyebrow={copy.acts.deliberation.eyebrow} title={copy.acts.deliberation.title} />
      <div className="mt-8 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_385px] lg:gap-16">
        <section className="rounded-panel border border-border bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-[17px] font-bold">
              {fill(copy.acts.deliberation.channel, { name: projectName(view.repo) })}
            </h2>
            <p className="label-mono">{copy.acts.deliberation.readOnly}</p>
          </header>
          <ol className="grid gap-4 px-5 py-6">
            {view.panel?.chat.map((m, i) => (
              <li key={i} className="flex items-end gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold",
                    AVATAR[m.judge],
                  )}
                >
                  {copy.judges[m.judge].initials}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-text-subtle">{copy.judges[m.judge].name}</p>
                  <p className="mt-1 w-fit rounded-card bg-surface-2 px-3.5 py-2 text-[16px]">{m.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="label-mono uppercase">{copy.acts.deliberation.night}</h2>
          <ol className="mt-6 grid gap-3">
            {view.events.map((e, i) => (
              <li key={i} className="grid grid-cols-[48px_1fr] text-[16px]">
                <span className={cn("font-mono", DELTA[toneOf(e)])}>
                  {e.delta > 0 ? `+${e.delta}` : e.delta}
                </span>
                <span>{e.reason}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <ActFooter label={copy.acts.deliberation.next} onClick={onNext} disabled={pending} />
    </>
  );
}
