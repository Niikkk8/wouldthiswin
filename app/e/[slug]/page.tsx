import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventEntry } from "@/components/events/event-entry";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import { eventBySlug } from "@/lib/events";
import type { EventPreset } from "@/lib/events/types";
import { SITE_URL } from "@/lib/site";

const E = copy.events;

/** "15 November 2026, 12:00 UTC". Shown in UTC so the server and every visitor agree. */
const utc = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = eventBySlug(slug);
  if (!event) return { robots: { index: false, follow: false } };
  const title = fill(E.metaTitle, { name: event.name }).slice(0, 60);
  const description = fill(E.metaDescription, { name: event.name }).slice(0, 155);
  const url = `${SITE_URL}/e/${slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url }, twitter: { card: "summary_large_image", title, description } };
}

export default function EventPage({ params }: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Event params={params} />
    </Suspense>
  );
}

function JudgedOn({ event }: { event: EventPreset }) {
  const total = event.rubric.criteria.reduce((n, c) => n + c.weight, 0) || 1;
  return (
    <section aria-labelledby="judged-on" className="mt-14 max-w-[760px]">
      <h2 id="judged-on" className="label-mono uppercase">
        {E.judgedOn}
      </h2>
      <ul className="mt-4 border-t border-border">
        {event.rubric.criteria.map((c) => (
          <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 border-b border-border py-4">
            <p className="text-[17px] font-bold">{c.name}</p>
            <p className="font-mono text-[14px] text-text-muted tabular-nums">{Math.round((c.weight / total) * 100)}%</p>
            <p className="col-span-2 text-[15px] leading-snug text-pretty text-text-muted">{c.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Event({ params }: { params: PageProps<"/e/[slug]">["params"] }) {
  const { slug } = await params;
  const event = eventBySlug(slug);
  if (!event) notFound();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12 lg:pb-20">
        <p className="label-mono uppercase">{E.eyebrow}</p>
        <h1 className="mt-3 max-w-[960px] text-[40px] leading-[0.95] font-black tracking-[-0.04em] text-balance break-words lg:text-act">{event.name}</h1>
        <p className="mt-5 font-mono text-[15px] text-text-muted">
          {E.deadline} {event.endsAt ? utc(event.endsAt) : event.deadlineText}
        </p>
        <a href={event.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-[14px] text-text-subtle underline decoration-1 underline-offset-4 hover:text-text">
          {E.site}
        </a>
        <p className="mt-8 max-w-[620px] text-[19px] leading-[1.45] text-text-muted">{E.lede}</p>
        <div className="mt-8">
          <EventEntry
            slug={event.slug}
            name={event.name}
            startsAt={event.startsAt}
            endsAt={event.endsAt}
            tracks={event.sponsorSignatures.map((s) => s.track)}
          />
        </div>
        <JudgedOn event={event} />
      </main>
      <SiteFooter />
    </div>
  );
}
