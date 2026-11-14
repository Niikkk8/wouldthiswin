import { ImageResponse } from "next/og";
import { VerdictCard } from "@/components/share/verdict-card";
import { copy } from "@/lib/copy";
import { log } from "@/lib/log";
import { ogFonts } from "@/lib/og-fonts";
import type { Review } from "@/lib/review";
import { loadPublicReview } from "@/lib/session-store";
import { SITE_URL } from "@/lib/site";

export const alt = copy.meta.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function draw(review: Review): Promise<ArrayBuffer> {
  const delta = review.iteration ? review.odds - review.iteration.previousOdds : null;
  return new ImageResponse(<VerdictCard r={review} delta={delta} />, {
    ...size,
    fonts: await ogFonts(),
  }).arrayBuffer();
}

/**
 * The shared verdict's preview. On any error (the review gone private, a font fetch failing,
 * the renderer choking on something) it falls back to the site's own static card, so a link
 * preview never breaks.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const review = await loadPublicReview(id);
    if (!review) throw new Error("not shareable");
    const png = await draw(review);
    return new Response(png, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    log.warn("og.verdict.fallback", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.redirect(`${SITE_URL}/opengraph-image`, 302);
  }
}
