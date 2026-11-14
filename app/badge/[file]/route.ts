import { badgeSvg } from "@/lib/badge";
import { loadPublicReview } from "@/lib/session-store";

/** GET /badge/ID.svg: that session's result. It never changes, so caches can keep it an hour. */
export async function GET(_req: Request, ctx: RouteContext<"/badge/[file]">) {
  const { file } = await ctx.params;
  const id = /^([a-z2-9]{10})\.svg$/.exec(file)?.[1];
  const review = id ? await loadPublicReview(id).catch(() => null) : null;
  if (!review)
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(badgeSvg(review.odds, review.tier), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
