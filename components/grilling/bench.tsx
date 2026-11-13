"use client";

import { JudgePortrait, type ReactionCue } from "@/components/judge-portrait";
import { JUDGES, type Judge } from "@/lib/session";

/**
 * The panel beside the question: the judge asking, large, talking while the question types
 * out; the other two small, reacting to the score. On a phone everyone is 128px and the
 * two listening sit in narrower windows.
 */
export function Bench({
  asker,
  talking,
  cue,
  dozing,
}: {
  asker: Judge;
  talking: boolean;
  cue: ReactionCue | null;
  dozing: boolean;
}) {
  const others = JUDGES.filter((j) => j !== asker);
  return (
    <div className="flex items-end gap-2 lg:flex-col lg:items-start">
      <div className="overflow-hidden rounded-card border border-border">
        <JudgePortrait judge={asker} size={128} talking={talking} dozing={dozing} label={false} className="lg:hidden" />
        <JudgePortrait judge={asker} size={256} talking={talking} dozing={dozing} label={false} className="hidden lg:block" />
      </div>
      <div className="flex gap-2">
        {others.map((j) => (
          <div key={j} className="w-[92px] overflow-hidden rounded-card border border-border lg:w-auto">
            <JudgePortrait judge={j} reaction={cue} dozing={dozing} className="-mx-[19px] lg:mx-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

