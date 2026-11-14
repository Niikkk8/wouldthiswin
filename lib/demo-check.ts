import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;

export type DemoCheck = {
  loads: boolean;
  status: number | null;
  finalUrl: string | null;
  /** The page's <title>, when the demo served HTML. */
  title: string | null;
  /** The title is still a framework's starter default ("Create Next App", "Vite + React", ...). */
  defaultTitle: boolean;
  /** Short machine reason when loads is false. */
  reason:
    | null
    | "invalidUrl"
    | "badProtocol"
    | "blockedAddress"
    | "dnsFailed"
    | "timeout"
    | "tooManyRedirects"
    | "httpError"
    | "networkError";
  ms: number;
};

const v4Blocked: [string, number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local / cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

const v6Blocked: [string, number][] = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8], // multicast
];

const blockList = new net.BlockList();
for (const [a, p] of v4Blocked) blockList.addSubnet(a, p, "ipv4");
for (const [a, p] of v6Blocked) blockList.addSubnet(a, p, "ipv6");

/** Parse an IPv6 string into 16 bytes, or null. */
function ipv6Bytes(addr: string): number[] | null {
  let s = addr.split("%")[0]; // drop zone id
  let tail: number[] = [];
  const v4m = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4m) {
    if (net.isIPv4(v4m[1]) === false) return null;
    tail = v4m[1].split(".").map(Number);
    s = s.slice(0, -v4m[1].length) + "0:0";
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":") : []);
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 1 ? fill !== 0 : fill < 0) return null;
  const groups = [...head, ...Array(Math.max(fill, 0)).fill("0"), ...rest];
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const n = parseInt(g, 16);
    bytes.push(n >> 8, n & 0xff);
  }
  if (tail.length) bytes.splice(12, 4, ...tail);
  return bytes;
}

/** Returns an IPv4 address embedded in an IPv6 address via a known mapping, if any. */
function embeddedV4(addr: string): string | null {
  const b = ipv6Bytes(addr);
  if (!b) return null;
  const zero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  const v4 = (o: number) => b.slice(o, o + 4).join(".");
  // ::ffff:a.b.c.d (mapped) and ::a.b.c.d (deprecated compatible)
  if (zero(0, 10) && ((b[10] === 0xff && b[11] === 0xff) || (b[10] === 0 && b[11] === 0))) {
    return v4(12);
  }
  // 64:ff9b::/96 NAT64
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zero(4, 12)) {
    return v4(12);
  }
  // 2002::/16 6to4
  if (b[0] === 0x20 && b[1] === 0x02) return v4(2);
  return null;
}

export function isBlockedAddress(addr: string): boolean {
  const family = net.isIP(addr);
  if (family === 4) return blockList.check(addr, "ipv4");
  if (family === 6) {
    if (blockList.check(addr, "ipv6")) return true;
    const v4 = embeddedV4(addr);
    return v4 ? blockList.check(v4, "ipv4") : false;
  }
  return true; // not an IP at all: refuse
}

class BlockedError extends Error {
  code = "EBLOCKED";
}

/**
 * DNS lookup used for the actual socket connection. Validating here (rather
 * than resolving once up front) means a rebinding DNS server can't swap in a
 * private address between the check and the connect.
 */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return callback(new BlockedError(`blocked address for ${hostname}`), "", 4);
    }
    if ((options as dns.LookupOptions).all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

type Hop = { status: number; location: string | null; title: string | null; cookies: string[] };

/**
 * Cookies set during the redirect chain, sent back on later hops. Some hosts (Streamlit
 * Community Cloud) bounce a cookieless visitor through an auth redirect that only ends once
 * the cookie it just set comes back, so without this a live app looks like a redirect loop.
 */
export type Jar = Map<string, { value: string; domain: string; hostOnly: boolean }>;

export function keepCookies(jar: Jar, setCookie: string[], host: string) {
  for (const line of setCookie) {
    const [pair, ...attrs] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const domainAttr = attrs
      .map((a) =>
        a
          .trim()
          .match(/^domain=\.?(.+)$/i)?.[1]
          ?.toLowerCase(),
      )
      .find(Boolean);
    // A Domain attribute must cover the host that set it, or the cookie is ignored.
    if (domainAttr && host !== domainAttr && !host.endsWith("." + domainAttr)) continue;
    jar.set(`${name}@${domainAttr ?? host}`, {
      value: `${name}=${value}`,
      domain: domainAttr ?? host,
      hostOnly: !domainAttr,
    });
  }
}

export function cookieHeader(jar: Jar, host: string): string | undefined {
  const sent = [...jar.values()]
    .filter((c) => host === c.domain || (!c.hostOnly && host.endsWith("." + c.domain)))
    .map((c) => c.value);
  return sent.length ? sent.join("; ") : undefined;
}

const TITLE_SCAN_BYTES = 64 * 1024;

/** Starter titles judges recognise instantly: the page was never made the team's own. */
const DEFAULT_TITLES =
  /^(create next app|next\.js|vite \+ react( \+ ts)?|vite \+ vue( \+ ts)?|vite app|react app|svelte app|sveltekit|nuxt|astro|streamlit|gradio|expo|document|untitled|home|my app|app)$/i;

function readTitle(res: http.IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let html = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      res.destroy();
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      resolve(m ? m[1].replace(/\s+/g, " ").trim().slice(0, 140) || null : null);
    };
    res.setEncoding("utf8");
    res.on("data", (chunk: string) => {
      html += chunk;
      if (html.length >= TITLE_SCAN_BYTES || /<\/title>/i.test(html)) finish();
    });
    res.on("end", finish);
    res.on("error", finish);
  });
}

function requestOnce(url: URL, signal: AbortSignal, cookie?: string): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; WouldThisWinDemoCheck/1.0)",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          ...(cookie ? { cookie } : {}),
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const cookies = res.headers["set-cookie"] ?? [];
        const html = /text\/html/i.test(String(res.headers["content-type"] ?? ""));
        if (status >= 200 && status < 300 && html) {
          // Only the <title> is needed; stop reading as soon as it's seen.
          readTitle(res).then((title) => resolve({ status, location, title, cookies }));
        } else {
          res.destroy(); // headers are enough; don't download the body
          resolve({ status, location, title: null, cookies });
        }
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function checkUrlShape(u: URL): DemoCheck["reason"] {
  if (u.protocol !== "http:" && u.protocol !== "https:") return "badProtocol";
  if (u.username || u.password) return "invalidUrl";
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return "blockedAddress";
  // Node skips `lookup` for IP literals, so they must be checked here.
  if (net.isIP(host) && isBlockedAddress(host)) return "blockedAddress";
  return null;
}

/** Checks whether a public demo URL responds with a non-error status within 5s. */
export async function checkDemo(input: string): Promise<DemoCheck> {
  const started = Date.now();
  const done = (
    r: Omit<DemoCheck, "ms" | "title" | "defaultTitle"> & { title?: string | null },
  ) => {
    const title = r.title ?? null;
    return {
      ...r,
      title,
      defaultTitle: title !== null && DEFAULT_TITLES.test(title),
      ms: Date.now() - started,
    } satisfies DemoCheck;
  };

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return done({ loads: false, status: null, finalUrl: null, reason: "invalidUrl" });
  }

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const jar: Jar = new Map();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const shape = checkUrlShape(url);
    if (shape) return done({ loads: false, status: null, finalUrl: url.href, reason: shape });

    let res: Hop;
    try {
      const host = url.hostname.toLowerCase();
      res = await requestOnce(url, signal, cookieHeader(jar, host));
      keepCookies(jar, res.cookies, host);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      const reason: DemoCheck["reason"] =
        e instanceof BlockedError || e?.code === "EBLOCKED"
          ? "blockedAddress"
          : signal.aborted || e?.name === "AbortError" || e?.name === "TimeoutError"
            ? "timeout"
            : e?.code === "ENOTFOUND" || e?.code === "EAI_AGAIN"
              ? "dnsFailed"
              : "networkError";
      return done({ loads: false, status: null, finalUrl: url.href, reason });
    }

    if (res.status >= 300 && res.status < 400 && res.location) {
      try {
        url = new URL(res.location, url);
      } catch {
        return done({ loads: false, status: res.status, finalUrl: url.href, reason: "invalidUrl" });
      }
      continue; // next hop is re-validated at the top of the loop
    }

    const ok = res.status >= 200 && res.status < 400;
    return done({
      loads: ok,
      status: res.status,
      finalUrl: url.href,
      title: res.title,
      reason: ok ? null : "httpError",
    });
  }

  return done({ loads: false, status: null, finalUrl: url.href, reason: "tooManyRedirects" });
}

export type Page = {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  contentType: string | null;
  /** The body as text, cut at `maxBytes`. Empty for non-text responses. */
  body: string;
  truncated: boolean;
  reason: DemoCheck["reason"];
};

export type PageOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  /** When set, only these hosts (and their subdomains) may be fetched, on every hop. */
  allowHosts?: readonly string[];
};

const PAGE_DEFAULTS = { timeoutMs: 5000, maxRedirects: 3, maxBytes: 512 * 1024 };

const TEXTUAL = /^(text\/|application\/(json|xhtml\+xml|xml|ld\+json))/i;

function hostAllowed(host: string, allow: readonly string[] | undefined): boolean {
  if (!allow) return true;
  const h = host.toLowerCase();
  return allow.some((a) => h === a || h.endsWith(`.${a}`));
}

function readBody(
  res: http.IncomingMessage,
  maxBytes: number,
): Promise<{ body: string; truncated: boolean }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      res.destroy();
      resolve({ body: Buffer.concat(chunks).toString("utf8"), truncated });
    };
    res.on("data", (chunk: Buffer) => {
      if (size + chunk.length > maxBytes) {
        chunks.push(chunk.subarray(0, maxBytes - size));
        truncated = true;
        return finish();
      }
      size += chunk.length;
      chunks.push(chunk);
    });
    res.on("end", finish);
    res.on("error", finish);
  });
}

function pageOnce(url: URL, signal: AbortSignal, maxBytes: number, cookie?: string) {
  return new Promise<{
    status: number;
    location: string | null;
    cookies: string[];
    contentType: string | null;
    body: string;
    truncated: boolean;
  }>((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; WouldThisWinCheck/1.0)",
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          ...(cookie ? { cookie } : {}),
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const cookies = res.headers["set-cookie"] ?? [];
        const contentType =
          typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : null;
        if (status >= 300 && status < 400) {
          res.destroy();
          return resolve({ status, location, cookies, contentType, body: "", truncated: false });
        }
        if (!contentType || !TEXTUAL.test(contentType)) {
          res.destroy();
          return resolve({ status, location, cookies, contentType, body: "", truncated: false });
        }
        readBody(res, maxBytes).then(({ body, truncated }) =>
          resolve({ status, location, cookies, contentType, body, truncated }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetches a public page's text through the same guards as checkDemo: GET only, addresses
 * checked at DNS time on every hop, a timeout, a redirect limit and a size cap. The body is
 * untrusted: callers parse it and never pass it on as instructions.
 */
export async function fetchPage(input: string, options: PageOptions = {}): Promise<Page> {
  const o = { ...PAGE_DEFAULTS, ...options };
  const fail = (
    reason: DemoCheck["reason"],
    status: number | null = null,
    finalUrl: string | null = null,
  ): Page => ({
    ok: false,
    status,
    finalUrl,
    contentType: null,
    body: "",
    truncated: false,
    reason,
  });
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return fail("invalidUrl");
  }
  const signal = AbortSignal.timeout(o.timeoutMs);
  const jar: Jar = new Map();
  for (let hop = 0; hop <= o.maxRedirects; hop++) {
    const shape = checkUrlShape(url);
    if (shape) return fail(shape, null, url.href);
    if (!hostAllowed(url.hostname, o.allowHosts)) return fail("blockedAddress", null, url.href);
    let res: Awaited<ReturnType<typeof pageOnce>>;
    try {
      const host = url.hostname.toLowerCase();
      res = await pageOnce(url, signal, o.maxBytes, cookieHeader(jar, host));
      keepCookies(jar, res.cookies, host);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      const reason: DemoCheck["reason"] =
        e instanceof BlockedError || e?.code === "EBLOCKED"
          ? "blockedAddress"
          : signal.aborted || e?.name === "AbortError" || e?.name === "TimeoutError"
            ? "timeout"
            : e?.code === "ENOTFOUND" || e?.code === "EAI_AGAIN"
              ? "dnsFailed"
              : "networkError";
      return fail(reason, null, url.href);
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      try {
        url = new URL(res.location, url);
      } catch {
        return fail("invalidUrl", res.status, url.href);
      }
      continue;
    }
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: res.status,
      finalUrl: url.href,
      contentType: res.contentType,
      body: res.body,
      truncated: res.truncated,
      reason: ok ? null : "httpError",
    };
  }
  return fail("tooManyRedirects", null, url.href);
}
