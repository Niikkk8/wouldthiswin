import type { Metadata } from "next";
import { RequestForm } from "@/components/organizers/request-form";
import { StatsPanel } from "@/components/organizers/stats-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy } from "@/lib/copy";
import { pageMeta } from "@/lib/seo";

const O = copy.organizers;

export const metadata: Metadata = pageMeta({
  title: O.metaTitle,
  description: O.metaDescription,
  path: "/organizers",
});

/** Made-up numbers, labelled as such: what an organizer's stats link shows. */
const EXAMPLE = {
  sessions: 64,
  finished: 51,
  averageOdds: 47,
  topFindings: [
    { check: "readme", sessions: 38 },
    { check: "claim", sessions: 33 },
    { check: "demo", sessions: 21 },
    { check: "setup", sessions: 17 },
    { check: "template", sessions: 9 },
  ],
};

export default function OrganizersPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12">
        <h1 className="max-w-[900px] text-[40px] leading-[0.95] font-black tracking-[-0.04em] text-balance lg:text-act">
          {O.title}
        </h1>
        <p className="mt-6 max-w-[640px] text-[19px] leading-[1.45] text-text-muted">{O.lede}</p>
        <ul className="mt-8 grid max-w-[640px] list-disc gap-2 pl-6 text-[17px] text-text-muted">
          {O.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <section aria-labelledby="example" className="mt-14 max-w-[640px]">
          <h2 id="example" className="text-[24px] font-black tracking-[-0.03em]">
            {O.stats.heading}
          </h2>
          <p className="mt-2 text-[16px] text-text-muted">{O.stats.lede}</p>
          <div className="mt-5">
            <StatsPanel stats={EXAMPLE} label={O.stats.example} />
          </div>
        </section>
        <section aria-labelledby="add" className="mt-14">
          <h2 id="add" className="text-[24px] font-black tracking-[-0.03em]">
            {O.form.heading}
          </h2>
          <p className="mt-2 mb-6 max-w-[620px] text-[16px] text-text-muted">{O.form.lede}</p>
          <RequestForm />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
