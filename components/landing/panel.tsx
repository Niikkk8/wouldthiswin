import { JudgeRow } from "@/components/judge-portrait";
import { copy } from "@/lib/copy";

/** The three judges, idle and blinking, and who plays them. */
export function Panel() {
  return (
    <section aria-labelledby="panel-heading">
      <h2 id="panel-heading" className="label-mono uppercase">
        {copy.landing.panel}
      </h2>
      <JudgeRow names className="mt-4" />
      <h3 className="label-mono mt-6 uppercase">{copy.landing.madeBy}</h3>
      <p className="mt-2 text-[15px] leading-snug text-text-muted">{copy.landing.credits}</p>
    </section>
  );
}
