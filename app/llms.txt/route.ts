import { allGuides, guidePath } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

/** A short map of the site for language models (llmstxt.org). */
export async function GET() {
  const guides = await allGuides();
  const body = [
    "# Would This Win?",
    "",
    "> A free pre-flight check for hackathon projects. Paste a public GitHub repo: three AI judges check every claim in the README against the code, grill the team with timed questions, and return a verdict styled as a code review, with the odds computed in code from cited evidence.",
    "",
    "## Pages",
    `- [Home](${SITE_URL}/): start a session`,
    `- [Sample session](${SITE_URL}/demo): a full session on sample data`,
    `- [Privacy](${SITE_URL}/privacy): what is stored and for how long`,
    "",
    "## Guides",
    ...guides.map((g) => `- [${g.title}](${SITE_URL}${guidePath(g.slug)}): ${g.description}`),
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
