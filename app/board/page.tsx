import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardList } from "@/components/board/board-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy } from "@/lib/copy";
import { eventBySlug } from "@/lib/events";
import { pageMeta } from "@/lib/seo";
import { BOARD_SORTS, boardEntries, type BoardSort } from "@/lib/session-store";

const B = copy.board;

export const metadata: Metadata = pageMeta({
  title: B.metaTitle,
  description: B.metaDescription,
  path: "/board",
});

export default function BoardPage({ searchParams }: PageProps<"/board">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12">
        <h1 className="text-[40px] leading-none font-black tracking-[-0.04em] lg:text-act">
          {B.title}
        </h1>
        <p className="mt-4 max-w-[620px] text-[18px] leading-snug text-text-muted">{B.lede}</p>
        <Suspense fallback={<p className="label-mono mt-10">{B.loading}</p>}>
          <Entries searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Entries({ searchParams }: { searchParams: PageProps<"/board">["searchParams"] }) {
  const sp = await searchParams;
  const sort: BoardSort = BOARD_SORTS.includes(sp.sort as BoardSort)
    ? (sp.sort as BoardSort)
    : "recent";
  const event = typeof sp.event === "string" && eventBySlug(sp.event) ? sp.event : null;
  const entries = await boardEntries({ sort, eventSlug: event });
  return <BoardList entries={entries} base="/board" sort={sort} event={event} />;
}
