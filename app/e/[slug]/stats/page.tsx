import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatsPanel } from "@/components/organizers/stats-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import { eventBySlug } from "@/lib/events";
import { eventStats, statsKeyValid } from "@/lib/organizers";
import { eventSessions } from "@/lib/session-store";

export const metadata: Metadata = {
  title: copy.organizers.stats.heading,
  robots: { index: false, follow: false },
};

/** An event's anonymous stats, for its organizers: /e/SLUG/stats?key=... (lib/organizers.ts statsKey). */
export default function EventStatsPage(props: PageProps<"/e/[slug]/stats">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12">
        <Suspense fallback={<p className="label-mono">{copy.board.loading}</p>}>
          <Stats {...props} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Stats({ params, searchParams }: PageProps<"/e/[slug]/stats">) {
  const event = eventBySlug((await params).slug);
  const key = (await searchParams).key;
  if (!event || !statsKeyValid(event.slug, typeof key === "string" ? key : undefined)) notFound();
  const stats = eventStats(await eventSessions(event.slug));
  return (
    <>
      <h1 className="text-[40px] leading-none font-black tracking-[-0.04em] text-balance lg:text-act">
        {fill(copy.organizers.stats.title, { name: event.name })}
      </h1>
      <p className="mt-4 max-w-[620px] text-[17px] text-text-muted">
        {copy.organizers.stats.private}
      </p>
      <div className="mt-8 max-w-[640px]">
        <StatsPanel stats={stats} />
      </div>
    </>
  );
}
