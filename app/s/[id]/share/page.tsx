import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PhoneShare } from "@/components/session/phone-share";
import { SiteHeader } from "@/components/site-header";
import { loadPublicReview } from "@/lib/session-store";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The share screen for a finished review, opened from the QR code on a desktop's share
 * screen. It shows only what the public review already does: the images and the link.
 */
export default function SharePage({ params }: PageProps<"/s/[id]/share">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Share params={params} />
    </Suspense>
  );
}

async function Share({ params }: { params: PageProps<"/s/[id]/share">["params"] }) {
  const { id } = await params;
  const review = await loadPublicReview(id);
  if (!review) notFound();
  return <PhoneShare review={review} />;
}
