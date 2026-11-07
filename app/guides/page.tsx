import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy } from "@/lib/copy";
import { allGuides, formatDate, guidePath } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

const G = copy.guides;

export const metadata: Metadata = {
  title: `${G.title} · ${copy.meta.name}`,
  description: G.lede,
  alternates: { canonical: "/guides" },
  openGraph: { title: `${G.title} · ${copy.meta.name}`, description: G.lede, url: `${SITE_URL}/guides` },
};

export default async function GuidesPage() {
  const guides = await allGuides();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-x flex-1 pt-10 pb-20 lg:pt-14">
        <h1 className="text-[36px] leading-none font-black tracking-[-0.04em] lg:text-act">{G.title}</h1>
        <p className="mt-6 max-w-[640px] text-[19px] leading-[1.45] text-text-muted lg:text-[22px]">{G.lede}</p>
        {guides.length === 0 ? (
          <p className="label-mono mt-12">{G.empty}</p>
        ) : (
          <ul className="mt-12 grid max-w-[880px] gap-4">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link
                  href={guidePath(g.slug)}
                  className="block rounded-panel border border-border bg-surface p-6 transition-colors hover:border-border-strong sm:p-7"
                >
                  <p className="label-mono">
                    <time dateTime={g.date}>{formatDate(g.date)}</time>
                  </p>
                  <h2 className="mt-3 text-[24px] leading-tight font-black tracking-[-0.03em] text-balance lg:text-[28px]">{g.title}</h2>
                  <p className="mt-3 text-[17px] leading-snug text-text-muted">{g.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
