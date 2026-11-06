import { copy } from "@/lib/copy";

/** The weakness to own before a judge finds it, on its own pink sticky note. */
export function BreaksFirstNote({ text }: { text: string }) {
  return (
    <section
      className="note-curl grain relative rotate-[1.2deg] bg-note-pink px-5 pb-6 pt-5 shadow-[0_8px_14px_-10px_rgba(0,0,0,0.45)] sm:px-6"
      style={{ ["--note" as string]: "#ffadd2" }}
    >
      <h2 className="text-base font-bold">{copy.result.breaksFirstHeading}</h2>
      <p className="mt-3 font-hand text-xl leading-snug">{text}</p>
    </section>
  );
}
