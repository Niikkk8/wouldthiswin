import { ImageResponse } from "next/og";
import { ShareCard } from "@/components/share-card";
import { ogFonts } from "@/lib/og-fonts";
import { loadPublicReview } from "@/lib/session-store";

export async function GET(_req: Request, ctx: RouteContext<"/og/[id]">) {
  const { id } = await ctx.params;
  const review = await loadPublicReview(id).catch(() => null);
  if (!review) return new Response("Not found", { status: 404 });
  const fonts = await ogFonts();
  return new ImageResponse(<ShareCard r={review} />, {
    width: 1200,
    height: 630,
    fonts,
    headers: { "cache-control": "public, max-age=3600, s-maxage=3600" },
  });
}
