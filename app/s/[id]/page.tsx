import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionShell } from "@/components/session/session-shell";
import { SiteHeader } from "@/components/site-header";
import { loadPublicReview, loadView } from "@/lib/session-store";
import { verdictPath } from "@/lib/site";

/** Never indexed: the session itself is private. Once shared, its public face is /v/[id]. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SessionPage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Session params={params} />
    </Suspense>
  );
}

/**
 * The owner resumes the session at the server's act. Anyone else is sent to the shared
 * verdict, if the owner made it shareable; otherwise there's nothing here for them.
 */
async function Session({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  const view = await loadView(id);
  if (view) return <SessionShell initial={view} />;
  const review = await loadPublicReview(id);
  if (!review) notFound();
  redirect(verdictPath(id));
}
