import { copy, fill } from "@/lib/copy";
import type { EventStats } from "@/lib/organizers";

const S = copy.organizers.stats;

/** An event's anonymous numbers: sessions, the average odds, the problems teams hit most. */
export function StatsPanel({ stats, label }: { stats: EventStats; label?: string }) {
  return (
    <section
      aria-label={label ?? S.heading}
      className="rounded-panel border border-border bg-surface p-5 sm:p-6"
    >
      {label && <p className="label-mono mb-4 text-unclear uppercase">{label}</p>}
      <dl className="grid grid-cols-3 gap-4">
        {[
          [S.sessions, String(stats.sessions)],
          [S.finished, String(stats.finished)],
          [S.average, stats.averageOdds === null ? S.none : `${stats.averageOdds}%`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="label-mono">{k}</dt>
            <dd className="mt-1 font-mono text-[28px] font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="label-mono mt-6 uppercase">{S.top}</h3>
      {stats.topFindings.length ? (
        <ul className="mt-2 grid gap-1">
          {stats.topFindings.map((f) => (
            <li
              key={f.check}
              className="flex justify-between gap-4 border-b border-border py-1.5 text-[15px] last:border-0"
            >
              <span>{S.checks[f.check as keyof typeof S.checks] ?? f.check}</span>
              <span className="font-mono whitespace-nowrap text-text-muted tabular-nums">
                {fill(S.inSessions, { n: f.sessions })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-text-muted">{S.none}</p>
      )}
    </section>
  );
}
