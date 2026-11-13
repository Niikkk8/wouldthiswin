import { ImageResponse } from "next/og";
import { POST_FORMATS, SHARE_FORMATS, ShareCard, type PostFormat } from "@/components/share-card";
import { ID_RE } from "@/lib/db";
import { ogFonts } from "@/lib/og-fonts";
import { loadReviewForImage } from "@/lib/session-store";

const isFormat = (f: string): f is PostFormat => (POST_FORMATS as readonly string[]).includes(f);

/**
 * A finished review's share image in one of the post formats: /og/ID/landscape.png,
 * /og/ID/portrait.png or /og/ID/story.png. Its owner can make them before sharing; anyone
 * else only once it's shareable, and only then does the CDN keep a copy.
 */
export async function GET(_req: Request, ctx: RouteContext<"/og/[id]/[format]">) {
  const { id, format: file } = await ctx.params;
  const format = file.replace(/\.png$/, "");
  if (!ID_RE.test(id) || !isFormat(format)) return new Response("Not found", { status: 404 });
  const found = await loadReviewForImage(id).catch(() => null);
  if (!found) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const fonts = await ogFonts();
  return new ImageResponse(<ShareCard r={found.review} format={format} />, {
    ...SHARE_FORMATS[format],
    fonts,
    headers: { "cache-control": found.cache },
  });
}
