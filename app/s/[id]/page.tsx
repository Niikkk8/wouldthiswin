import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewView } from "@/components/review/review-view";
import { SessionShell } from "@/components/session/session-shell";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { loadPublicReview, loadView } from "@/lib/session-store";
import { SITE_URL, ogPath, reviewPath } from "@/lib/site";

const projectName = (repo: string) => repo.split("/").pop() ?? repo;

/** Never indexed. A finished review gets a share card so the link previews well. */
export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const base: Metadata = { robots: { index: false, follow: false } };
  const review = await loadPublicReview(id).catch(() => null);
  if (!review) return base;
  const title = `${projectName(review.repo)}: ${review.odds}% · ${copy.meta.title}`;
  const image = { url: SITE_URL + ogPath(id), width: 1200, height: 630, alt: `${review.repo}, ${review.odds}%` };
  return {
    ...base,
    title,
    description: review.oneLiner,
    alternates: { canonical: SITE_URL + reviewPath(id) },
    openGraph: { title, description: review.oneLiner, url: SITE_URL + reviewPath(id), images: [image], type: "article" },
    twitter: { card: "summary_large_image", title, description: review.oneLiner, images: [image.url] },
  };
}

export default function SessionPage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Session params={params} />
    </Suspense>
  );
}

/**
 * The owner resumes the session at the server's act. Anyone else with the link sees only
 * the act 4 review, once there is one: never the answers or the transcript.
 */
async function Session({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  const view = await loadView(id);
  if (view) return <SessionShell initial={view} />;
  const review = await loadPublicReview(id);
  if (!review) notFound();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader repo={review.repo} />
      <main className="page-x flex-1 pb-16 lg:pb-20">
        <ReviewView review={review} />
        <div className="mt-16 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[20px] leading-snug font-bold">{copy.review.yours}</p>
          <Link href="/" className={buttonVariants({ className: "w-full sm:w-auto" })}>
            {copy.review.yoursCta}
          </Link>
        </div>
      </main>
    </div>
  );
}
