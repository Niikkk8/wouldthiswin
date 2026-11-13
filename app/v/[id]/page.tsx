import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OddsDelta } from "@/components/review/rejudge-delta";
import { projectName } from "@/components/review/review-parts";
import { ShareLinks } from "@/components/share/share-links";
import { VerdictSummary } from "@/components/share/verdict-summary";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { loadPublicReview } from "@/lib/session-store";
import { SITE_URL, shareText, verdictPath } from "@/lib/site";

/**
 * A shared verdict. Only exists once its owner made it shareable; indexed only if they also
 * listed it publicly. Its preview image is ./opengraph-image.tsx.
 */
export async function generateMetadata({ params }: PageProps<"/v/[id]">): Promise<Metadata> {
  const { id } = await params;
  const review = await loadPublicReview(id).catch(() => null);
  if (!review) return { robots: { index: false, follow: false } };
  const title = `${projectName(review.repo)}: ${review.odds}% chance to win`.slice(0, 60);
  const description = `${shareText(review)} ${copy.review.remember} "${review.oneLiner}"`.slice(0, 155);
  const url = SITE_URL + verdictPath(id);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: review.listed ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, url, type: "article", siteName: copy.meta.name },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function VerdictPage({ params }: PageProps<"/v/[id]">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Verdict params={params} />
    </Suspense>
  );
}

async function Verdict({ params }: { params: PageProps<"/v/[id]">["params"] }) {
  const { id } = await params;
  const review = await loadPublicReview(id);
  if (!review) notFound();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader repo={review.repo} />
      <main id="main" tabIndex={-1} className="page-x flex-1 pb-16 lg:pb-20">
        <VerdictSummary
          review={review}
          delta={review.iteration && <OddsDelta from={review.iteration.previousOdds} to={review.odds} className="mt-2 text-[17px] lg:justify-end" />}
        />
        <ShareLinks review={review} className="mt-12" />
        <div className="mt-16 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[20px] leading-snug font-bold">{copy.review.yours}</p>
          <Link href="/" className={buttonVariants({ className: "w-full sm:w-auto" })}>
            {copy.review.yoursCta}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
