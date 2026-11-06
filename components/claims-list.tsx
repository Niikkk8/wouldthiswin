import { copy } from "@/lib/copy";
import type { Judgment } from "@/lib/judge";

const MARK = {
  backed: { glyph: "✓", className: "text-ink" },
  unbacked: { glyph: "✗", className: "text-marker-red" },
  unclear: { glyph: "?", className: "text-graphite" },
} as const;

/** README claims checked against the repo, written on the board: backed in black, unbacked in red. */
export function ClaimsList({ claims }: { claims: Judgment["claims"] }) {
  return (
    <section>
      <h2 className="font-hand text-2xl font-bold">{copy.result.claimsHeading}</h2>
      <ul className="mt-4 space-y-4">
        {claims.map((c) => {
          const mark = MARK[c.status];
          return (
            <li key={c.claim} className="grid grid-cols-[1.75rem_minmax(0,1fr)]">
              <span
                className={`font-hand text-2xl font-bold leading-7 ${mark.className}`}
                aria-hidden="true"
              >
                {mark.glyph}
              </span>
              <div>
                <p className={`font-hand text-xl font-bold leading-7 ${mark.className}`}>
                  <span className="sr-only">{copy.result.claimStatus[c.status]}: </span>
                  {c.claim}
                </p>
                <p className="mt-0.5 text-sm text-graphite text-pretty">{c.evidence}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
