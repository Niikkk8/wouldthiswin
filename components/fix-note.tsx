import { copy } from "@/lib/copy";

/** Fixes in priority order, on a sticky note stuck to the whiteboard. */
export function FixNote({ fixes }: { fixes: readonly string[] }) {
  return (
    <section className="-rotate-1 bg-sticky px-5 pb-6 pt-5 shadow-[0_8px_14px_-10px_rgba(0,0,0,0.45)] sm:px-6">
      <h2 className="text-base font-bold">{copy.fixesHeader}</h2>
      <ol className="mt-4 space-y-3.5">
        {fixes.map((fix) => (
          <li key={fix} className="flex gap-3 font-hand text-xl leading-snug">
            <span className="mt-1 size-4 shrink-0 border-2 border-ink" aria-hidden="true" />
            <span>{fix}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
