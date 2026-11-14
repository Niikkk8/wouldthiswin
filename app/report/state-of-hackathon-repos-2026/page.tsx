import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import type { ResearchAggregate } from "@/lib/research";

const R = copy.report;
const DATA = join(process.cwd(), "content/research/state-of-hackathon-repos-2026.json");

// A draft: out of the sitemap and the nav, and noindex, until Niket approves it.
export const metadata: Metadata = {
  title: R.title,
  description: R.description,
  robots: { index: false, follow: false },
};

function load(): ResearchAggregate | null {
  try {
    return JSON.parse(readFileSync(DATA, "utf8")) as ResearchAggregate;
  } catch {
    return null;
  }
}

const pct = (n: number, of: number) => Math.round((n / Math.max(1, of)) * 100);

function Bars({ rows, of }: { rows: { label: string; repos: number }[]; of: number }) {
  return (
    <ul className="mt-6 grid gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-4 text-[15px]">
            <span className="first-letter:uppercase">{r.label}</span>
            <span className="font-mono whitespace-nowrap text-text-muted tabular-nums">
              {pct(r.repos, of)}%
            </span>
          </div>
          <div aria-hidden className="mt-1.5 h-2 rounded-full bg-surface">
            <div className="h-2 rounded-full bg-gain" style={{ width: `${pct(r.repos, of)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ReportPage() {
  const data = load();
  if (!data || data.scanned === 0) notFound();
  const n = data.scanned;
  const date = new Date(data.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12">
        <h1 className="max-w-[900px] text-[40px] leading-[0.95] font-black tracking-[-0.04em] text-balance lg:text-act">
          {R.title}
        </h1>
        <p className="mt-6 max-w-[640px] text-[19px] leading-[1.45] text-text-muted">
          {fill(R.lede, { n })}
        </p>
        <dl className="mt-10 grid max-w-[880px] gap-6 sm:grid-cols-3">
          {[
            [`${pct(n - data.clean, n)}%`, R.headline.problem],
            [`${pct(data.withDemo, n)}%`, R.headline.demo],
            [String(n), R.headline.scanned],
          ].map(([v, k]) => (
            <div key={k} className="flex flex-col-reverse border-t border-border pt-4">
              <dt className="mt-2 text-[15px] text-text-muted">{k}</dt>
              <dd className="font-mono text-[44px] leading-none font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="kinds" className="mt-16 max-w-[640px]">
          <h2 id="kinds" className="text-[24px] font-black tracking-[-0.03em]">
            {R.kindsHeading}
          </h2>
          <p className="mt-2 text-[16px] text-text-muted">{R.kindsLede}</p>
          <Bars rows={data.kinds.map((k) => ({ label: R.kinds[k.kind], repos: k.repos }))} of={n} />
        </section>
        {data.aiLevels.length > 0 && (
          <section aria-labelledby="ai" className="mt-16 max-w-[640px]">
            <h2 id="ai" className="text-[24px] font-black tracking-[-0.03em]">
              {R.aiHeading}
            </h2>
            <p className="mt-2 text-[16px] text-text-muted">{R.aiLede}</p>
            <Bars
              rows={data.aiLevels.map((l) => ({
                label: copy.checks.ai.levels[l.level],
                repos: l.repos,
              }))}
              of={n}
            />
          </section>
        )}
        <section aria-labelledby="method" className="mt-16 max-w-[640px]">
          <h2 id="method" className="text-[24px] font-black tracking-[-0.03em]">
            {R.methodHeading}
          </h2>
          <ul className="mt-4 grid list-disc gap-2 pl-6 text-[16px] text-text-muted">
            {R.method.map((m) => (
              <li key={m}>{fill(m, { min: data.minCell })}</li>
            ))}
            {data.failed > 0 && <li>{fill(R.failed, { n: data.failed })}</li>}
          </ul>
          <p className="label-mono mt-6">{fill(R.generated, { date })}</p>
        </section>
        <Link
          href="/"
          className="mt-12 inline-flex h-12 items-center rounded-control bg-text px-6 font-bold text-bg"
        >
          {R.cta}
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
