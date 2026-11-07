import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search engines get the landing page only. Session pages also carry noindex.
// Link-preview bots honour robots.txt too, so they're let into review links and the share
// card; without that, a review posted to X or Slack would show no card.
const PREVIEW_BOTS = ["Twitterbot", "facebookexternalhit", "LinkedInBot", "Slackbot", "Slackbot-LinkExpanding", "Discordbot", "TelegramBot", "WhatsApp"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/s/", "/api/"] },
      { userAgent: PREVIEW_BOTS, allow: ["/", "/s/", "/og/"], disallow: ["/api/"] },
    ],
    host: SITE_URL,
  };
}
