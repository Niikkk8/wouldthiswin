"use client";

import { SiteHeader } from "@/components/site-header";
import { copy } from "@/lib/copy";
import type { Review } from "@/lib/review";
import { ActFrame } from "./action-bar";
import { ShareScreen } from "./share-act";

/** The share screen on its own, for the phone that scanned the QR code. */
export function PhoneShare({ review }: { review: Review }) {
  return (
    <ActFrame resetKey="share" step={copy.header.share} header={<SiteHeader repo={review.repo} status={copy.header.share} />}>
      <ShareScreen review={review} phone />
    </ActFrame>
  );
}
