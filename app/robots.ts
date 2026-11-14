import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Every crawler, AI search ones included, may read the public pages; none get the API or
// private sessions. Link-preview bots also read /s/ (which redirects to a shared verdict) and
// the share cards, or a posted link would show no card.
const PREVIEW_BOTS = ["Twitterbot", "facebookexternalhit", "LinkedInBot", "Slackbot", "Slackbot-LinkExpanding", "Discordbot", "TelegramBot", "WhatsApp"];
const AI_SEARCH = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/s/", "/capture"] },
      { userAgent: AI_SEARCH, allow: "/", disallow: ["/api/", "/s/", "/capture"] },
      { userAgent: PREVIEW_BOTS, allow: ["/", "/s/", "/og/"], disallow: ["/api/"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
