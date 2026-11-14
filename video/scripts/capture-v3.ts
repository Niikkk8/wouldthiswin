// v3 capture: the real app, frame by frame at 30 fps, at 2x device scale or more, with the
// on-screen rectangle of every element a shot can land on, recorded per frame.
//
// Same method as scripts/capture.ts: Playwright's fake clock drives every timer and every
// CSS / Web Animation is paused and stepped by hand, so each frame is the app exactly 1/30 s
// after the last. The difference is resolution (crisp under a 1.5x push-in) and the rects:
// meta.json holds, per frame, where the odds, the caught phrase, the answer box, each judge
// and each fix-list item sit in device pixels. The compositions point the camera at those.
//
//   16x9: 1280x900 desktop viewport at 2x -> 2560x1800 (taller than 16:9 so nothing scrolls away)
//   9x16:  540x960 phone viewport at 3x  -> 1620x2880
//
// Takes come from the dev-only capture routes (/capture/[act], PulseBoard fixture) plus the
// real landing page (typed, never submitted) and the demo repo's README.
//
// Usage: npm run capture:v3 -- [16x9|9x16|all] [take,take|all]
// Needs the app: `npx next dev -p 3124` in the repo root (or BASE_URL).

import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ffmpeg, PUBLIC, VIDEO } from "./lib";

const BASE = process.env.BASE_URL ?? "http://localhost:3124";
const RAW = join(VIDEO, "capture", "v3");
const OUT = join(PUBLIC, "capture", "v3");
const FPS = 30;
const REPO = "github.com/team-pulse/pulseboard";

export const ASPECTS = {
  "16x9": { viewport: { width: 1280, height: 900 }, scale: 2 },
  "9x16": { viewport: { width: 540, height: 960 }, scale: 3 },
} as const;
export type Aspect = keyof typeof ASPECTS;

/** Where to find each element a camera can land on. Missing ones are skipped per frame. */
const TARGETS: Target[] = [
  { name: "odds", css: "number-flow-react", pick: "big" },
  { name: "oddsBox", css: "number-flow-react", pick: "big", up: 4 },
  { name: "pct", text: "^[0-9]{1,3}%$", pick: "big" },
  { name: "chip", css: 'p[class*="rounded-[6px]"]', pick: "last" },
  { name: "question", css: "h1", pick: "big" },
  { name: "caught", text: "^Math\\.random\\(\\)\\.?$" },
  { name: "answer", css: "#answer" },
  { name: "mic", css: 'button[aria-label="Answer out loud"]' },
  { name: "judge", css: "[data-judge]", all: true },
  { name: "claim", text: "^CrowdNet, a custom model", up: 1 },
  { name: "file", text: "crowdnet\\.ts" },
  { name: "repo", css: "#repo" },
  { name: "key", text: "^OpenAI API key in the repo", up: 1 },
  { name: "title", text: "Create Next App", up: 1 },
  { name: "env", text: "^\\.env is committed", up: 1 },
  { name: "deadlink", text: "^Demo link is dead", up: 1 },
  { name: "fixlist", css: "#fix-list" },
  { name: "tier", text: "^(Honorable mention|Winner|Finalist|Changes requested)\\.?$", pick: "big" },
  { name: "card", css: '[role="img"]', pick: "big" },
  { name: "since", text: "[Ss]ince (the )?(last|round one)", up: 1 },
  { name: "chat", css: "li", pick: "last" },
  { name: "readmeClaim", text: "custom AI model", up: 0 },
];

type Target = {
  name: string;
  css?: string;
  text?: string;
  pick?: "first" | "last" | "big";
  up?: number;
  all?: boolean;
};
type Rect = [number, number, number, number];
type Frame = {
  f: number;
  rects: Record<string, Rect>;
  odds: string | null;
  answer: number;
  chat: number;
  typed: number;
  step: string | null;
  scrollY: number;
};

/** Pauses every animation the page starts and moves it on by hand, in step with the fake clock. */
const STEPPER = `
(() => {
  const seen = new WeakMap();
  window.__step = (now) => {
    for (const a of document.getAnimations()) {
      let s = seen.get(a);
      if (!s) { s = { start: now - (a.currentTime ?? 0) }; seen.set(a, s); try { a.pause(); } catch {} }
      if (a.playState === "finished" || a.playState === "idle") continue;
      const t = now - s.start;
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      const end = timing ? timing.endTime : Infinity;
      if (Number.isFinite(end) && t >= end) { try { a.finish(); } catch { a.currentTime = end; } }
      else a.currentTime = t;
    }
  };
})();
`;

/** Runs in the page: the rect of each target, in device pixels, plus a few readings for sound. */
const PROBE = `
window.__probe = (targets, dpr) => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05; };
  const size = (el) => parseFloat(getComputedStyle(el).fontSize) || 0;
  const byText = (src) => {
    const re = new RegExp(src); const hits = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(".sr-only,[aria-hidden=true] .sr-only")) continue;
      if (re.test((n.textContent || "").trim()) || re.test((el.textContent || "").trim())) if (!hits.includes(el)) hits.push(el);
    }
    return hits.filter(vis).filter((el) => !hits.some((o) => o !== el && el.contains(o)));
  };
  const rects = {};
  const put = (name, el) => { const r = el.getBoundingClientRect(); rects[name] = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * dpr)); };
  for (const t of targets) {
    let els = t.css ? [...document.querySelectorAll(t.css)].filter(vis) : byText(t.text);
    if (!els.length) continue;
    if (t.all) { els.forEach((el, i) => put(t.name + (el.getAttribute("data-judge") ? ":" + el.getAttribute("data-judge") : i), el)); continue; }
    let el = t.pick === "last" ? els[els.length - 1] : t.pick === "big" ? els.reduce((a, b) => (size(b) * b.getBoundingClientRect().height > size(a) * a.getBoundingClientRect().height ? b : a)) : els[0];
    for (let i = 0; i < (t.up || 0) && el.parentElement; i++) el = el.parentElement;
    put(t.name, el);
  }
  const odds = [...document.querySelectorAll("p.sr-only")].map((p) => (p.textContent || "").match(/(\\d+) percent/)?.[1]).find(Boolean) ?? null;
  const ta = document.querySelector("textarea");
  const input = document.querySelector("#repo");
  const sc = document.querySelector("[data-act-scroll]");
  return { rects, odds, answer: ta ? ta.value.length : 0, chat: document.querySelectorAll("li").length, typed: input ? input.value.length : 0, step: document.querySelector("[data-act-step]")?.textContent?.trim() ?? null, scrollY: sc ? sc.scrollTop : window.scrollY };
};
`;

async function open(aspect: Aspect, url: string) {
  const { viewport, scale } = ASPECTS[aspect];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  // The landing form's POST never comes back: nothing real is ever started.
  await page.route("**/api/sessions", () => new Promise(() => {}));
  await page.route(/_vercel\/insights|va\.vercel-scripts/, (r) => r.abort());
  await page.clock.install({ time: new Date("2026-11-14T21:00:00Z") });
  await page.addInitScript(STEPPER);
  await page.addInitScript(PROBE);
  await page.addInitScript("globalThis.__name = (f) => f;");
  await page.addInitScript(() => {
    const css =
      "nextjs-portal{display:none!important} *{caret-color:transparent!important} ::-webkit-scrollbar{display:none} html{scrollbar-width:none} [data-sonner-toaster]{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    });
  });
  await page.clock.pauseAt(new Date("2026-11-14T21:00:00.000Z"));
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  return { browser, page, scale };
}

class Recorder {
  private f = 0;
  private ms = 0;
  readonly meta: Frame[] = [];
  constructor(
    private page: Page,
    private dir: string,
    private dpr: number,
  ) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  get frame() {
    return this.f;
  }
  get last() {
    return this.meta.at(-1);
  }
  private async step(ms: number) {
    await this.page.clock.runFor(ms);
    this.ms += ms;
    await this.page.evaluate((now) => (window as unknown as { __step: (n: number) => void }).__step(now), this.ms);
  }
  async shot() {
    await this.page.screenshot({ path: join(this.dir, `${String(this.f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 93, caret: "hide", animations: "allow" });
    const m = await this.page.evaluate(([t, d]) => (window as unknown as { __probe: (t: unknown, d: number) => Omit<Frame, "f"> }).__probe(t, d), [TARGETS, this.dpr] as const);
    this.meta.push({ f: this.f, ...m });
    const next = Math.round(((this.f + 1) * 1000) / FPS);
    await this.step(next - Math.round((this.f * 1000) / FPS));
    this.f++;
  }
  async record(seconds: number) {
    const n = Math.round(seconds * FPS);
    for (let i = 0; i < n; i++) await this.shot();
  }
  /** Records until `done` holds (checked each frame), at most `maxSeconds`. */
  async until(done: () => Promise<boolean>, maxSeconds: number) {
    const stop = this.f + maxSeconds * FPS;
    while (this.f < stop) {
      await this.shot();
      if (await done()) return true;
    }
    console.log(`    gave up waiting after ${maxSeconds}s`);
    return false;
  }
  /** Scrolls the act (or the page) to `y` with an ease-in-out, one step per frame. */
  async glide(y: (page: Page) => Promise<number>, seconds: number) {
    const from = await this.page.evaluate(() => {
      const sc = document.querySelector("[data-act-scroll]");
      return sc ? sc.scrollTop : window.scrollY;
    });
    const to = await y(this.page);
    const n = Math.round(seconds * FPS);
    for (let i = 1; i <= n; i++) {
      const p = i / n;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      await this.page.evaluate((top) => {
        const sc = document.querySelector("[data-act-scroll]");
        if (sc) sc.scrollTo({ top, behavior: "instant" });
        else window.scrollTo({ top, behavior: "instant" });
      }, Math.round(from + (to - from) * e));
      await this.shot();
    }
  }
  save() {
    writeFileSync(join(this.dir, "meta.json"), JSON.stringify({ fps: FPS, dpr: this.dpr, frames: this.meta }));
  }
}

/** Scroll target that puts the element matching `text` at `at` of the viewport height. */
const scrollTo = (text: string, at: number) => async (page: Page) =>
  page.evaluate(
    ([src, k]) => {
      const re = new RegExp(src as string);
      const el = [...document.querySelectorAll("h3, p, span, div")].find((e) => re.test((e.textContent || "").trim()) && !e.children.length);
      const sc = document.querySelector("[data-act-scroll]");
      if (!el) return sc ? sc.scrollTop : window.scrollY;
      const top = el.getBoundingClientRect().top + (sc ? sc.scrollTop - sc.getBoundingClientRect().top : window.scrollY);
      const h = sc ? sc.clientHeight : innerHeight;
      return Math.max(0, top - h * (k as number));
    },
    [text, at] as const,
  );

const readyButton = (page: Page, name: RegExp) => page.locator("[data-action] button[data-ready]:not([disabled])").filter({ hasText: name });

type TakeFn = (rec: Recorder, page: Page) => Promise<void>;

const README_HTML = (md: string) => {
  // The demo repo's README, laid out the way GitHub's dark theme shows it.
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
  const body = md
    .split(/\n{2,}/)
    .map((b) => {
      if (b.startsWith("# ")) return `<h1>${inline(b.slice(2))}</h1>`;
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
      if (/^[-*] /m.test(b)) return `<ul>${b.split("\n").map((l) => `<li>${inline(l.replace(/^[-*] /, ""))}</li>`).join("")}</ul>`;
      if (b.startsWith("```")) return `<pre>${esc(b.replace(/```\w*\n?/g, ""))}</pre>`;
      return `<p>${inline(b)}</p>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#0d1117;color:#e6edf3;font:16px/1.6 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
  .bar{padding:14px 24px;border-bottom:1px solid #30363d;color:#8d96a0;font-size:14px}.bar b{color:#e6edf3}
  .box{max-width:880px;margin:24px auto;border:1px solid #30363d;border-radius:6px}
  .hd{padding:10px 16px;border-bottom:1px solid #30363d;font-size:14px;font-weight:600}
  .md{padding:24px 32px}h1{font-size:2em;border-bottom:1px solid #30363d;padding-bottom:.3em;margin:0 0 16px}
  h2{font-size:1.5em;border-bottom:1px solid #30363d;padding-bottom:.3em}code{background:#6e768166;padding:.2em .4em;border-radius:6px;font-size:85%}
  pre{background:#161b22;padding:16px;border-radius:6px}</style>
  <div class="bar">team-pulse / <b>pulseboard</b></div><div class="box"><div class="hd">README.md</div><div class="md">${body}</div></div>`;
};

const TAKES: Record<string, { url: string; run: TakeFn }> = {
  landing: {
    url: "/",
    run: async (rec, page) => {
      await rec.record(1.2);
      await page.locator("#repo").focus();
      await rec.record(0.2);
      for (const ch of REPO) {
        await page.keyboard.type(ch);
        await rec.shot();
      }
      await rec.record(1.2);
    },
  },
  scan: {
    url: "/capture/scan",
    run: async (rec, page) => {
      await rec.until(async () => (await readyButton(page, /grilling|panel/i).count()) > 0, 30);
      await rec.record(1);
    },
  },
  grilling: {
    url: "/capture/grilling",
    run: async (rec, page) => {
      const mic = page.getByRole("button", { name: "Answer out loud" });
      await rec.until(async () => (await mic.count()) > 0 && (await mic.isEnabled()), 20);
      await rec.record(1.6);
      await mic.click();
      await rec.until(async () => (rec.last?.answer ?? 0) >= 150, 20);
      await rec.record(1.4);
      await mic.click();
      await rec.record(0.8);
      await page.locator("#answer").press("Enter");
      await rec.record(6);
    },
  },
  deliberation: {
    url: "/capture/deliberation",
    run: async (rec, page) => {
      await rec.until(async () => (await readyButton(page, /review/i).count()) > 0, 30);
      await rec.record(1);
    },
  },
  verdict: {
    url: "/capture/verdict",
    run: async (rec) => {
      await rec.record(3.2);
      await rec.glide(async (p) => (await p.evaluate(() => innerHeight)) * 0.75, 1.6);
      await rec.record(1.5);
    },
  },
  fixes: {
    url: "/capture/fixes",
    run: async (rec) => {
      await rec.record(2);
      await rec.glide(scrollTo("^OpenAI API key in the repo", 0.3), 1.2);
      await rec.record(2);
      await rec.glide(scrollTo("Create Next App", 0.3), 1.2);
      await rec.record(2);
    },
  },
  share: {
    url: "/capture/share",
    run: async (rec) => {
      await rec.record(4);
    },
  },
  rejudge: {
    url: "/capture/rejudge",
    run: async (rec) => {
      await rec.record(3);
      await rec.glide(scrollTo("[Ss]ince (the )?(last|round one)", 0.25), 1.4);
      await rec.record(2.5);
    },
  },
  readme: {
    url: "readme",
    run: async (rec, page) => {
      await rec.record(1);
      await rec.glide(scrollTo("custom AI model", 0.35), 1.6);
      await rec.record(2);
      void page;
    },
  },
};

async function take(aspect: Aspect, name: string) {
  const t = TAKES[name];
  let url = BASE + t.url;
  if (t.url === "readme") {
    const md = readFileSync(join(VIDEO, "..", "..", "wtw-demo-repo", "README.md"), "utf8");
    const file = join(RAW, "readme.html");
    mkdirSync(RAW, { recursive: true });
    writeFileSync(file, README_HTML(md));
    url = "file:///" + file.replace(/\\/g, "/");
  }
  const { browser, page, scale } = await open(aspect, url);
  const dir = join(RAW, aspect, name);
  const rec = new Recorder(page, dir, scale);
  await t.run(rec, page);
  rec.save();
  await browser.close();
  // Frames to one near-lossless file the compositions read, next to its meta.
  mkdirSync(OUT, { recursive: true });
  ffmpeg(["-framerate", String(FPS), "-i", join(dir, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(OUT, `${aspect}-${name}.mp4`)]);
  writeFileSync(join(OUT, `${aspect}-${name}.json`), readFileSync(join(dir, "meta.json")));
  return rec.frame;
}

const want = (arg: string | undefined, all: string[]) => (!arg || arg === "all" ? all : arg.split(","));
if (process.argv[1]?.includes("capture-v3")) {
  const aspects = want(process.argv[2], Object.keys(ASPECTS)) as Aspect[];
  const takes = want(process.argv[3], Object.keys(TAKES));
  for (const aspect of aspects)
    for (const name of takes) {
      const t0 = Date.now();
      process.stdout.write(`${aspect} ${name}... `);
      const n = await take(aspect, name);
      console.log(`${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  if (!existsSync(OUT)) process.exit(1);
}
