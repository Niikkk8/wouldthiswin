import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import { evidenceHref, evidenceLabel } from "@/lib/findings";
import { loadPublicReport } from "@/lib/public-scan";

const R = copy.publicReport;

/** A CLI scan's report. Never indexed: it's a link someone ran on their own repo. */
export const metadata: Metadata = { title: R.metaTitle, robots: { index: false, follow: false } };

export default function ReportPage({ params }: PageProps<"/r/[id]">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Report params={params} />
    </Suspense>
  );
}

const SEVERITY: Record<string, string> = {
  blocker: "bg-loss text-bg",
  major: "bg-unclear text-bg",
  minor: "border border-border-strong text-text-muted",
};

async function Report({ params }: { params: PageProps<"/r/[id]">["params"] }) {
  const report = await loadPublicReport((await params).id);
  if (!report) notFound();
  const problems = report.findings.filter((f) => f.outcome !== "pass");
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader repo={report.repo} />
      <main id="main" tabIndex={-1} className="page-x flex-1 pt-8 pb-16 lg:pt-12">
        <p className="label-mono uppercase">{R.eyebrow}</p>
        <h1 className="mt-3 text-[36px] leading-none font-black tracking-[-0.04em] break-words lg:text-act">
          {report.repo}
        </h1>
        <p className="mt-3 font-mono text-[14px] text-text-muted">
          {fill(R.commit, { sha: report.sha.slice(0, 7) })}
        </p>
        <Link
          href={`/?repo=${encodeURIComponent(report.repo)}#repo`}
          className={buttonVariants({ className: "mt-8 w-full sm:w-auto" })}
        >
          {R.cta}
        </Link>
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <section aria-labelledby="found">
            <h2 id="found" className="label-mono uppercase">
              {fill(R.findings, { n: problems.length })}
            </h2>
            {problems.length === 0 ? (
              <p className="mt-4 text-text-muted">{R.none}</p>
            ) : (
              <ul className="mt-4 grid gap-4 border-t border-border pt-4">
                {problems.map((f) => (
                  <li key={f.id}>
                    <p className="flex flex-wrap items-center gap-2">
                      {f.severity && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-mono text-[12px]",
                            SEVERITY[f.severity],
                          )}
                        >
                          {copy.fixList.severity[f.severity]}
                        </span>
                      )}
                      <span className="text-[16px] font-semibold">{f.title}</span>
                    </p>
                    <p className="mt-1 text-[15px] leading-snug text-text-muted">{f.detail}</p>
                    <ul className="mt-1 flex flex-wrap gap-x-3 font-mono text-[12px] text-text-subtle">
                      {f.evidence.map((e, i) => {
                        const href = evidenceHref(e, report.repo, report.sha);
                        return (
                          <li key={i}>
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all underline underline-offset-4 hover:text-text"
                              >
                                {evidenceLabel(e)}
                              </a>
                            ) : (
                              evidenceLabel(e)
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="claims">
            <h2 id="claims" className="label-mono uppercase">
              {fill(R.claims, { n: report.claims.length })}
            </h2>
            <p className="mt-2 text-[14px] text-text-subtle">{R.claimsNote}</p>
            <ul className="mt-4 grid list-disc gap-1.5 border-t border-border pt-4 pl-5 text-[16px] text-text-muted">
              {report.claims.map((c, i) => (
                <li key={i}>{c.text}</li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
