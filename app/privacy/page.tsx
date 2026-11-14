import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: copy.seo.privacy.title,
  description: copy.privacy.lede,
  path: "/privacy",
});

const UPDATED = "9 November 2026";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-10 pb-20 lg:pt-14">
        <article className="max-w-[720px]">
          <h1 className="text-[36px] leading-none font-black tracking-[-0.04em] lg:text-act">
            {copy.privacy.title}
          </h1>
          <p className="mt-6 text-[19px] leading-[1.45] text-text-muted lg:text-[22px]">
            {copy.privacy.lede}
          </p>
          {copy.privacy.sections.map((s) => (
            <section key={s.heading} className="mt-12">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">{s.heading}</h2>
              <ul className="mt-4 grid list-disc gap-3 pl-5 text-[17px] leading-[1.5] text-text-muted marker:text-text-subtle">
                {s.body.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
          <p className="label-mono mt-12">{fill(copy.privacy.updated, { date: UPDATED })}</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
