import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { copy, fill } from "@/lib/copy";
import { eventBySlug } from "@/lib/events";
import { guidePath } from "@/lib/guides";
import { pageMeta } from "@/lib/seo";
import { breadcrumbs } from "@/lib/structured-data";

const H = copy.hackathons;

/** Guides worth reading before any hackathon, linked from every hackathon page. */
const GUIDES = [
  "how-hackathon-judges-score-projects",
  "hackathon-submission-checklist",
  "questions-hackathon-judges-ask",
];

// A page per real event preset (lib/events/presets.ts) and nothing else: no thin pages for
// events we have no criteria for.
export async function generateMetadata({
  params,
}: PageProps<"/hackathons/[slug]">): Promise<Metadata> {
  const event = eventBySlug((await params).slug);
  if (!event) return { robots: { index: false, follow: false } };
  return pageMeta({
    title: fill(H.title, { name: event.name }),
    description: fill(H.description, { name: event.name }),
    path: `/hackathons/${event.slug}`,
  });
}

export default function HackathonPage({ params }: PageProps<"/hackathons/[slug]">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Hackathon params={params} />
    </Suspense>
  );
}

async function Hackathon({ params }: { params: PageProps<"/hackathons/[slug]">["params"] }) {
  const event = eventBySlug((await params).slug);
  if (!event) notFound();
  const total = event.rubric.criteria.reduce((n, c) => n + c.weight, 0) || 1;
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={breadcrumbs([{ name: event.name, path: `/hackathons/${event.slug}` }])} />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12">
        <article className="max-w-[760px]">
          <h1 className="text-[40px] leading-[0.95] font-black tracking-[-0.04em] text-balance break-words lg:text-act">
            {fill(H.heading, { name: event.name })}
          </h1>
          <p className="mt-6 text-[19px] leading-[1.45] text-text-muted">
            {fill(H.lede, { name: event.name })}
          </p>
          <section aria-labelledby="criteria" className="mt-12">
            <h2 id="criteria" className="text-[24px] font-black tracking-[-0.03em]">
              {fill(H.criteria, { name: event.name })}
            </h2>
            <ul className="mt-4 border-t border-border">
              {event.rubric.criteria.map((c) => (
                <li key={c.key} className="border-b border-border py-4">
                  <p className="text-[17px] font-bold">
                    {c.name}{" "}
                    <span className="font-mono text-[14px] font-normal text-text-muted">
                      {Math.round((c.weight / total) * 100)}%
                    </span>
                  </p>
                  <p className="mt-1 text-[15px] leading-snug text-text-muted">{c.description}</p>
                </li>
              ))}
            </ul>
          </section>
          {event.sponsorSignatures.length > 0 && (
            <section aria-labelledby="tracks" className="mt-12">
              <h2 id="tracks" className="text-[24px] font-black tracking-[-0.03em]">
                {H.tracks}
              </h2>
              <ul className="mt-4 grid list-disc gap-2 pl-6 text-[17px] text-text-muted">
                {event.sponsorSignatures.map((s) => (
                  <li key={s.track}>
                    {s.track} <span className="text-text-subtle">({s.sponsor})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Link
            href={`/e/${event.slug}`}
            className={buttonVariants({ className: "mt-12 w-full sm:w-auto" })}
          >
            {fill(H.cta, { name: event.name })}
          </Link>
          <nav aria-labelledby="before" className="mt-14 border-t border-border pt-6">
            <h2 id="before" className="label-mono uppercase">
              {H.guides}
            </h2>
            <ul className="mt-3 grid gap-2">
              {GUIDES.map((g) => (
                <li key={g}>
                  <Link
                    href={guidePath(g)}
                    className="text-[17px] underline underline-offset-4 hover:text-text-muted"
                  >
                    {H.guideTitles[g as keyof typeof H.guideTitles]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
