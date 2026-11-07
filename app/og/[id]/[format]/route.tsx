import { ImageResponse } from "next/og";
import { POST_FORMATS, SHARE_FORMATS, ShareCard, type PostFormat } from "@/components/share-card";
import { ID_RE } from "@/lib/db";
import { ogFonts } from "@/lib/og-fonts";
import { loadPublicReview } from "@/lib/session-store";

const isFormat = (f: string): f is PostFormat => (POST_FORMATS as readonly string[]).includes(f);

/**
 * A finished review's share image in one of the post formats: /og/ID/landscape.png,
 * /og/ID/portrait.png or /og/ID/story.png. Made on the first request, then served from the
 * CDN: a review never changes once it's written.
 */
export async function GET(_req: Request, ctx: RouteContext<"/og/[id]/[format]">) {
  const { id, format: file } = await ctx.params;
  const format = file.replace(/\.png$/, "");
  if (!ID_RE.test(id) || !isFormat(format)) return new Response("Not found", { status: 404 });
  const review = await loadPublicReview(id).catch(() => null);
  if (!review) return new Response("Not found", { status: 404 });
  const fonts = await ogFonts();
  return new ImageResponse(<ShareCard r={review} format={format} />, {
    ...SHARE_FORMATS[format],
    fonts,
    headers: { "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" },
  });
}
