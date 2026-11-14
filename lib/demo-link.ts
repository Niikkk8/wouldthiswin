// A demo link: a live site, or a video on one of the hosts judges actually watch. Pure, so
// the landing form and the server agree on what's accepted. The network check lives in
// demo-link-check.ts and goes through the SSRF-safe checkDemo.

export type VideoProvider = "youtube" | "loom" | "vimeo" | "drive";

export type DemoLink =
  { kind: "site"; url: string } | { kind: "video"; url: string; provider: VideoProvider };

const MAX_LENGTH = 500;

const VIDEO_HOSTS: [RegExp, VideoProvider][] = [
  [/^(www\.|m\.)?youtube\.com$|^youtu\.be$/i, "youtube"],
  [/^(www\.)?loom\.com$/i, "loom"],
  [/^(www\.|player\.)?vimeo\.com$/i, "vimeo"],
  [/^drive\.google\.com$/i, "drive"],
];

/** Which video host, if the path is actually a video on it (not the home page). */
function videoProvider(u: URL): VideoProvider | null {
  const match = VIDEO_HOSTS.find(([re]) => re.test(u.hostname));
  if (!match) return null;
  const [, provider] = match;
  const p = u.pathname;
  switch (provider) {
    case "youtube":
      return u.hostname.toLowerCase() === "youtu.be"
        ? /^\/[\w-]{6,}/.test(p)
          ? provider
          : null
        : u.searchParams.get("v") || /^\/(shorts|embed|live)\/[\w-]{6,}/.test(p)
          ? provider
          : null;
    case "loom":
      return /^\/(share|embed)\/[\w-]+/.test(p) ? provider : null;
    case "vimeo":
      return /\/\d{5,}/.test(p) ? provider : null;
    case "drive":
      return /^\/file\/d\/[\w-]+/.test(p) || u.searchParams.get("id") ? provider : null;
  }
}

/**
 * Reads what someone typed. Adds https:// if it's missing. Null for anything that isn't an
 * http(s) link to a public-looking host. A video host's home page counts as a site.
 */
export function parseDemoLink(input: string): DemoLink | null {
  const raw = input.trim();
  if (!raw || raw.length > MAX_LENGTH || /\s/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  // A dotted name: no bare "localhost", no single-label hosts. Addresses are checked again,
  // after DNS, by the SSRF-safe fetch.
  if (!u.hostname.includes(".") || u.hostname.endsWith(".")) return null;
  const provider = videoProvider(u);
  return provider ? { kind: "video", url: u.href, provider } : { kind: "site", url: u.href };
}
