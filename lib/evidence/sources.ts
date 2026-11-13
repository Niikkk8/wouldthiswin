// Where claims come from: the README always, plus what the team adds: a Devpost project page
// (fetched server-side, devpost.com only) and pasted submission text from anywhere else. All
// of it is untrusted material. Parsing is pure and tested; the fetch goes through fetchPage.

import { fetchPage, type Page } from "../demo-check";
import { DEVPOST_HOSTS, MAX_SUBMISSION_CHARS } from "./devpost-url";

export { MAX_SUBMISSION_CHARS, parseDevpostUrl } from "./devpost-url";

export type SourceKind = "readme" | "devpost" | "submission";

export type ClaimSource = { kind: SourceKind; text: string };

const MAX_SOURCE_CHARS = 8000;

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

const text = (html: string) =>
  decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

function section(html: string, id: string): string | null {
  const start = html.search(new RegExp(`id=["']${id}["']`, "i"));
  if (start < 0) return null;
  const rest = html.slice(start);
  const end = rest.search(/<(section|div)[^>]+id=["'](built-with|app-team|software-header|gallery)["']/i);
  return rest.slice(0, end > 0 ? end : 20_000);
}

export type Devpost = { about: string; builtWith: string[]; links: string[] };

/**
 * A Devpost project page: the "about" write-up, the "Built With" tags and the "Try it out"
 * links. Pure: no network. Anything it can't find comes back empty, never guessed.
 */
export function parseDevpost(html: string): Devpost {
  const details = section(html, "app-details-left");
  const about = details ? text(details).slice(0, MAX_SOURCE_CHARS) : "";
  const builtSection = section(html, "built-with") ?? "";
  const builtWith = [...builtSection.matchAll(/class=["'][^"']*cp-tag[^"']*["'][^>]*>([\s\S]*?)<\//gi)]
    .map((m) => text(m[1]))
    .filter(Boolean);
  const linksBlock = html.match(/<nav[^>]+class=["'][^"']*app-links[^"']*["'][\s\S]*?<\/nav>/i)?.[0] ?? "";
  const links = [...linksBlock.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => decode(m[1]));
  return { about, builtWith: [...new Set(builtWith)], links: [...new Set(links)] };
}

export async function fetchDevpost(url: string, fetch: (u: string) => Promise<Page> = (u) => fetchPage(u, { allowHosts: DEVPOST_HOSTS })): Promise<Devpost | null> {
  const page = await fetch(url);
  if (!page.ok || !page.body) return null;
  return parseDevpost(page.body);
}

/** The README, then Devpost, then the pasted text: every source with something in it. */
export function claimSources(input: { readme: string; devpost: Devpost | null; submission: string | null }): ClaimSource[] {
  const out: ClaimSource[] = [{ kind: "readme", text: input.readme.slice(0, MAX_SOURCE_CHARS) }];
  if (input.devpost && (input.devpost.about || input.devpost.builtWith.length)) {
    const built = input.devpost.builtWith.length ? `\nBuilt with: ${input.devpost.builtWith.join(", ")}` : "";
    out.push({ kind: "devpost", text: `${input.devpost.about}${built}`.trim().slice(0, MAX_SOURCE_CHARS) });
  }
  const pasted = input.submission?.trim();
  if (pasted) out.push({ kind: "submission", text: pasted.slice(0, MAX_SUBMISSION_CHARS) });
  return out;
}
