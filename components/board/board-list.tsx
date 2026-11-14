import Link from "next/link";
import { cn } from "cn";
import { projectName } from "@/components/review/review-parts";
import { copy, fill } from "@/lib/copy";
import { allEvents } from "@/lib/events";
import { BOARD_SORTS, type BoardEntry, type BoardSort } from "@/lib/session-store";
import { verdictPath } from "@/lib/site";
import { HideButton } from "./hide-button";

const B = copy.board;

/** The board's controls: sort, and (on the main board) which event. Plain links, so it works without JavaScript. */
function Controls({ base, sort, event }: { base: string; sort: BoardSort; event: string | null }) {
  const href = (s: BoardSort, e: string | null) =>
    `${base}?${new URLSearchParams({ sort: s, ...(e ? { event: e } : {}) }).toString()}`;
  const events = allEvents();
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 font-mono text-[13px] transition-colors",
      active
        ? "border-text bg-text text-bg"
        : "border-border-strong text-text-muted hover:text-text",
    );
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      {BOARD_SORTS.map((s) => (
        <Link
          key={s}
          href={href(s, event)}
          className={chip(s === sort)}
          aria-current={s === sort ? "page" : undefined}
        >
          {B.sort[s]}
        </Link>
      ))}
      {base === "/board" && events.length > 0 && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <Link href={href(sort, null)} className={chip(!event)}>
            {B.allEvents}
          </Link>
          {events.map((e) => (
            <Link key={e.slug} href={href(sort, e.slug)} className={chip(event === e.slug)}>
              {e.name}
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

export function BoardList({
  entries,
  base,
  sort,
  event,
}: {
  entries: BoardEntry[];
  base: string;
  sort: BoardSort;
  event: string | null;
}) {
  return (
    <>
      <Controls base={base} sort={sort} event={event} />
      {entries.length === 0 ? (
        <p className="mt-10 max-w-[560px] text-[17px] text-text-muted">{B.empty}</p>
      ) : (
        <ol className="mt-8 border-t border-border">
          {entries.map((e, i) => (
            <li
              key={e.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-border py-4"
            >
              <span className="w-8 text-right font-mono text-[14px] text-text-subtle tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <Link
                  href={verdictPath(e.id)}
                  className="text-[18px] font-bold break-words underline-offset-4 hover:underline"
                >
                  {projectName(e.repo)}
                </Link>
                <p className="mt-0.5 truncate text-[15px] text-text-muted">
                  &ldquo;{e.oneLiner}&rdquo;
                </p>
                <p className="mt-1 font-mono text-[12px] text-text-subtle">
                  {e.repo}
                  {e.mine && <HideButton id={e.id} />}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[22px] font-bold tabular-nums">{e.odds}%</p>
                <p className={cn("font-mono text-[12px]", e.ready ? "text-gain" : "text-loss")}>
                  {e.ready ? copy.review.ready : copy.review.changes}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="label-mono mt-6">
        {fill(B.howTo, { listed: copy.acts.share.visibility.listed })}
      </p>
    </>
  );
}
