// The parts of claim sources the browser needs too: what a Devpost link may be, and how long
// pasted text may be. No network code here, so client components can import it.

export const DEVPOST_HOSTS = ["devpost.com"] as const;
export const MAX_SUBMISSION_CHARS = 6000;

/** A Devpost project URL, normalized, or null. Only devpost.com and its subdomains. */
export function parseDevpostUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!DEVPOST_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  if (!/^\/software\/[\w-]+\/?$/.test(u.pathname)) return null;
  return `https://devpost.com${u.pathname.replace(/\/$/, "")}`;
}
