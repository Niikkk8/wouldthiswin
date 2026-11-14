import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { copy, fill } from "@/lib/copy";
import { formatDate, guidePath, guideSlugs, loadGuide, relatedGuides, visible } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
import { article, breadcrumbs } from "@/lib/structured-data";

const G = copy.guides;

// Every guide is built at deploy time; any other slug is a 404 (loadGuide finds no file).
export function generateStaticParams() {
  return guideSlugs().map((slug) => ({ slug }));
}

/** A guide that exists and may be shown here: drafts only outside production. */
async function shownGuide(slug: string) {
  const guide = await loadGuide(slug);
  return guide && visible(guide.meta) ? guide : null;
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const guide = await shownGuide((await params).slug);
  if (!guide) return {};
  const { meta } = guide;
  const base = pageMeta({ title: meta.title, description: meta.description, path: guidePath(meta.slug), type: "article", index: !meta.draft });
  return {
    ...base,
    authors: [{ name: copy.footer.author.name, url: copy.footer.author.url }],
    openGraph: { ...base.openGraph, type: "article", publishedTime: meta.date, modifiedTime: meta.updated ?? meta.date, authors: [copy.footer.author.url] },
  };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const guide = await shownGuide((await params).slug);
  if (!guide) notFound();
  const { meta, Body } = guide;
  const author = copy.footer.author;
  const next = await relatedGuides(meta);
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={article({ ...meta, url: SITE_URL + guidePath(meta.slug) })} />
      <JsonLd data={breadcrumbs([{ name: G.title, path: "/guides" }, { name: meta.title, path: guidePath(meta.slug) }])} />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-10 pb-20 lg:pt-14">
        <article className="max-w-[720px]">
          <header>
            <p className="label-mono uppercase">
              <Link href="/guides" className="hover:text-text">
                {G.eyebrow}
              </Link>
            </p>
            <h1 className="mt-3 text-[36px] leading-[1.02] font-black tracking-[-0.04em] text-balance lg:text-[56px]">{meta.title}</h1>
            <p className="mt-6 text-[19px] leading-[1.45] text-text-muted lg:text-[22px]">{meta.description}</p>
            <p className="label-mono mt-6 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                {G.by}{" "}
                <a href={author.url} target="_blank" rel="noopener author" className="text-text-muted underline underline-offset-4 hover:text-text">
                  {author.name}
                </a>
              </span>
              <span aria-hidden>·</span>
              <time dateTime={meta.updated ?? meta.date}>{fill(G.lastUpdated, { date: formatDate(meta.updated ?? meta.date) })}</time>
            </p>
            {meta.draft && <p className="label-mono mt-3 text-unclear">{G.draft}</p>}
          </header>
          <div className="mt-10 border-t border-border pt-4">
            <Body />
          </div>
          <section aria-labelledby="author" className="mt-16 flex flex-col gap-1 border-t border-border pt-8">
            <h2 id="author" className="label-mono uppercase">
              {G.author.heading}
            </h2>
            <p className="mt-2 text-[18px] font-bold">
              <a href={author.url} target="_blank" rel="noopener author" className="underline underline-offset-4 hover:text-text-muted">
                {author.name}
              </a>
            </p>
            <p className="text-[16px] leading-snug text-text-muted">{G.author.bio}</p>
          </section>
          {next.length > 0 && (
            <nav aria-labelledby="read-next" className="mt-12">
              <h2 id="read-next" className="label-mono uppercase">
                {G.readNext}
              </h2>
              <ul className="mt-4 grid gap-3 border-t border-border pt-4">
                {next.map((g) => (
                  <li key={g.slug}>
                    <Link href={guidePath(g.slug)} className="text-[18px] font-bold underline-offset-4 hover:underline">
                      {g.title}
                    </Link>
                    <p className="mt-0.5 text-[15px] leading-snug text-text-muted">{g.description}</p>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <aside className="mt-16 rounded-panel border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-[28px] leading-none font-black tracking-[-0.03em]">{G.cta.title}</h2>
            <p className="mt-4 text-[17px] leading-snug text-text-muted">{G.cta.body}</p>
            <Link href="/#repo" className={buttonVariants({ className: "mt-6 w-full sm:w-auto" })}>
              {G.cta.button}
            </Link>
          </aside>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
