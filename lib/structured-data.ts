// JSON-LD that matches what each page shows: the site, the app, its maker, the guides, and
// breadcrumbs. Nothing here may claim what the page doesn't say.

import { copy } from "./copy";
import { SITE_URL } from "./site";

const author = copy.footer.author;

/**
 * Niket: the profiles that are you (X, LinkedIn, GitHub...), for search engines to connect.
 * Left empty on purpose until you fill it in.
 */
export const PERSON_SAME_AS: string[] = [];

export const PERSON = {
  "@type": "Person",
  "@id": `${SITE_URL}/#creator`,
  name: author.name,
  url: author.url,
  ...(PERSON_SAME_AS.length ? { sameAs: PERSON_SAME_AS } : {}),
};

const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: copy.meta.name,
  url: `${SITE_URL}/`,
  description: copy.meta.description,
  publisher: { "@id": PERSON["@id"] },
};

/** The landing page: the site, and the app itself, free, made by Niket. */
export function webApplication() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      WEBSITE,
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: copy.meta.name,
        description: copy.meta.description,
        url: `${SITE_URL}/`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        creator: { "@id": PERSON["@id"] },
      },
      PERSON,
    ],
  };
}

/** A breadcrumb trail, home first. */
export function breadcrumbs(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: copy.meta.name, path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** A guide, with its author and both dates. */
export function article(g: { title: string; description: string; date: string; updated?: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    datePublished: g.date,
    dateModified: g.updated ?? g.date,
    url: g.url,
    mainEntityOfPage: g.url,
    image: `${SITE_URL}/opengraph-image`,
    author: PERSON,
    publisher: PERSON,
  };
}
