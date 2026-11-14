import type { MetadataRoute } from "next";
import { allEvents } from "@/lib/events";
import { allGuides, guidePath } from "@/lib/guides";
import { log } from "@/lib/log";
import { listedVerdicts } from "@/lib/session-store";
import { SITE_URL, verdictPath } from "@/lib/site";

// The public, indexable pages: home, the guides, hackathon pages, and verdicts their owners
// listed publicly. Sessions, unlisted verdicts and the API never appear here. The report joins
// once its numbers are approved.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const guides = await allGuides();
  const verdicts = await listedVerdicts().catch((err: unknown) => {
    log.warn("sitemap.verdicts", { error: String(err) });
    return [];
  });
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/demo`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/board`, changeFrequency: "daily", priority: 0.5 },
    { url: `${SITE_URL}/organizers`, changeFrequency: "monthly", priority: 0.5 },
    ...guides.map((g) => ({
      url: SITE_URL + guidePath(g.slug),
      lastModified: g.updated ?? g.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...allEvents().map((e) => ({
      url: `${SITE_URL}/hackathons/${e.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...verdicts.map((v) => ({
      url: SITE_URL + verdictPath(v.id),
      lastModified: v.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
