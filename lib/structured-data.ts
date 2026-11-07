// JSON-LD for the landing page and the guides.

import { copy } from "./copy";
import { SITE_URL } from "./site";

const author = copy.footer.author;

/** The site's creator. */
export const PERSON = {
  "@type": "Person",
  "@id": `${SITE_URL}/#creator`,
  name: author.name,
  url: author.url,
  sameAs: copy.footer.socials.map((s) => s.url),
};

/** The landing page: the app itself, free, made by Niket. */
export function webApplication() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: copy.meta.name,
        description: copy.meta.description,
        url: `${SITE_URL}/`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        creator: { "@id": PERSON["@id"] },
      },
      PERSON,
    ],
  };
}

/** A guide. */
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
