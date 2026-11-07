import type { MetadataRoute } from "next";
import { allGuides, guidePath } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

// The public, indexable pages only. Review links (/s/) and the API never appear here; they
// stay noindexed and disallowed in robots.txt.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const guides = await allGuides();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/demo`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.6 },
    ...guides.map((g) => ({
      url: SITE_URL + guidePath(g.slug),
      lastModified: g.updated ?? g.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
