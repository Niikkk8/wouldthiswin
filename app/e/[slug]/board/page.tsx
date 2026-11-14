import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoardList } from "@/components/board/board-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import { eventBySlug } from "@/lib/events";
import { pageMeta } from "@/lib/seo";
import { BOARD_SORTS, boardEntries, type BoardSort } from "@/lib/session-store";

const B = copy.board;

export async function generateMetadata({
  params,
}: PageProps<"/e/[slug]/board">): Promise<Metadata> {
  const event = eventBySlug((await params).slug);
  if (!event) return { robots: { index: false, follow: false } };
  return pageMeta({
    title: fill(B.eventTitle, { name: event.name }),
    description: fill(B.eventDescription, { name: event.name }),
    path: `/e/${event.slug}/board`,
  });
}

export default function EventBoardPage(props: PageProps<"/e/[slug]/board">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12">
        <Suspense fallback={<p className="label-mono">{B.loading}</p>}>
          <EventBoard {...props} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function EventBoard({ params, searchParams }: PageProps<"/e/[slug]/board">) {
  const event = eventBySlug((await params).slug);
  if (!event) notFound();
  const sp = await searchParams;
  const sort: BoardSort = BOARD_SORTS.includes(sp.sort as BoardSort)
    ? (sp.sort as BoardSort)
    : "top";
  const entries = await boardEntries({ sort, eventSlug: event.slug });
  return (
    <>
      <p className="label-mono uppercase">
        <Link href={`/e/${event.slug}`} className="hover:text-text">
          {event.name}
        </Link>
      </p>
      <h1 className="mt-3 text-[40px] leading-none font-black tracking-[-0.04em] lg:text-act">
        {B.title}
      </h1>
      <BoardList entries={entries} base={`/e/${event.slug}/board`} sort={sort} event={event.slug} />
    </>
  );
}
