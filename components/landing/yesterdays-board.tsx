import { copy } from "@/lib/copy";

/** Yesterday's results. Empty until the board is built. */
export function YesterdaysBoard() {
  return (
    <aside aria-labelledby="board-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="board-heading" className="label-mono whitespace-nowrap uppercase">
          {copy.landing.board.heading}
        </h2>
        <p className="label-mono">{copy.landing.board.note}</p>
      </div>
      <p className="mt-4 rounded-card bg-surface px-5 py-5 text-[16px] text-text-muted">
        {copy.landing.board.empty}
      </p>
    </aside>
  );
}
