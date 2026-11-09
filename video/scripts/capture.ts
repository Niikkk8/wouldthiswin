// Records the real app, frame by frame, at exactly 30fps.
//
// Real-time screen recording drops and smears frames. Instead, every timer runs on
// Playwright's fake clock and every CSS / Web Animation is paused and stepped by hand, so
// each frame is the app exactly 1/30s after the last. Frames are PNGs at the output size:
//   9x16: a 540x960 phone viewport at 2x (judges at 128 CSS px land on 256 device px)
//   16x9: a 1920x1080 desktop viewport at 1x (judges at 128 / 256 px)
// Whole-number scale either way, with image-rendering: pixelated, so the pixel art stays crisp.
//
// Takes (each an independent page load):
//   landing  the hero, the headline words rising in, then the repo typed and "Face the panel" pressed
//   demo     /demo from the scan to the share act; the action button is pressed once it's ready
//   doze     /demo again, but the sample team waits on question 3 so the Tired Judge nods off
//            (what happens in a real session after 10 seconds without a keystroke)
//
// Usage: npm run capture -- [9x16|16x9|all] [landing|demo|doze|all]
// Needs the site running: `npx next dev -p 3123` in the repo root (or BASE_URL).

import { chromium, type Page } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3123";
const ROOT = join(import.meta.dirname, "..", "public", "capture");
const FPS = 30;

/** The fixture's repo, as the storyboard types it. Swapped in the served JS, video only. */
const REPO_FROM = "queueless-team/queueless";
const REPO_TO = "latenight/queue-less";
export const TYPED_URL = "github.com/latenight/queue-less";

const ASPECTS = {
  "9x16": { viewport: { width: 540, height: 960 }, scale: 2 },
  "16x9": { viewport: { width: 1920, height: 1080 }, scale: 1 },
} as const;
type Aspect = keyof typeof ASPECTS;

type FrameInfo = {
  f: number;
  /** "Act 2 of 4" etc, from the action bar. */
  step: string | null;
  /** The big odds number. */
  odds: string | null;
  /** The newest delta chip, e.g. "-19SMS claim unbacked". */
  chip: string | null;
  /** Each visible judge portrait's frame, e.g. "engineer:talk". */
  judges: string[];
  /** Length of the answer field's text, so typing can be heard. */
  answer: number;
  /** Visible words in the question, and claim lines drawn in the scan. */
  words: number;
  lines: number;
  chat: number;
  button: string | null;
  typed: number;
};

/** Pauses every animation the page starts and moves it on by hand, in step with the fake clock. */
const STEPPER = `
(() => {
  const seen = new WeakMap();
  window.__step = (now) => {
    for (const a of document.getAnimations()) {
      let s = seen.get(a);
      if (!s) {
        s = { start: now - (a.currentTime ?? 0) };
        seen.set(a, s);
        try { a.pause(); } catch {}
      }
      if (a.playState === "finished" || a.playState === "idle") continue;
      const t = now - s.start;
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      const end = timing ? timing.endTime : Infinity;
      if (Number.isFinite(end) && t >= end) {
        try { a.finish(); } catch { a.currentTime = end; }
      } else {
        a.currentTime = t;
      }
    }
  };
})();
`;

async function open(aspect: Aspect, path: string, patch?: (js: string) => string) {
  const { viewport, scale } = ASPECTS[aspect];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  // Swap the fixture's repo name for the storyboard's in the served bundles.
  await page.route(/\/_next\/static\/.*\.js/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    if (body.includes(REPO_FROM)) body = body.split(REPO_FROM).join(REPO_TO);
    if (patch) body = patch(body);
    await route.fulfill({ response: res, body });
  });
  // The hero form's POST never comes back: the button holds on "Finding a panel".
  await page.route("**/api/sessions", () => new Promise(() => {}));
  // Analytics stays out of it.
  await page.route(/_vercel\/insights|va\.vercel-scripts/, (r) => r.abort());
  await page.clock.install({ time: new Date("2026-11-09T21:00:00Z") });
  await page.addInitScript(STEPPER);
  // tsx keeps function names with a __name helper; functions passed to evaluate need it too.
  await page.addInitScript("globalThis.__name = (f) => f;");
  // The Next dev badge and toasts are not the product.
  await page.addInitScript(() => {
    const css = "nextjs-portal{display:none!important} *{caret-color:transparent!important} ::-webkit-scrollbar{display:none} html{scrollbar-width:none}";
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    });
  });
  await page.clock.pauseAt(new Date("2026-11-09T21:00:00.000Z"));
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

class Recorder {
  private f = 0;
  private ms = 0;
  readonly meta: FrameInfo[] = [];
  constructor(
    private page: Page,
    private dir: string,
  ) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  get frame() {
    return this.f;
  }
  /** Moves the app on by one frame (fake clock, then animations), without recording. */
  async tick() {
    const next = Math.round(((this.f + 1) * 1000) / FPS);
    await this.page.clock.runFor(next - Math.round((this.f * 1000) / FPS));
    this.ms = next;
    await this.page.evaluate((now) => (window as unknown as { __step: (n: number) => void }).__step(now), this.ms);
  }
  /** Records the current frame, then moves on one. */
  async shot() {
    const p = join(this.dir, `${String(this.f).padStart(5, "0")}.png`);
    await this.page.screenshot({ path: p, caret: "hide", animations: "allow" });
    this.meta.push({ f: this.f, ...(await this.page.evaluate(probe)) });
    await this.tick();
    this.f++;
  }
  async record(frames: number) {
    for (let i = 0; i < frames; i++) await this.shot();
  }
  /** Runs the app forward without recording (time still passes; the recording jumps). */
  async skip(ms: number) {
    await this.page.clock.runFor(ms);
    this.ms += ms;
    await this.page.evaluate((now) => (window as unknown as { __step: (n: number) => void }).__step(now), this.ms);
  }
  save() {
    writeFileSync(join(this.dir, "meta.json"), JSON.stringify(this.meta));
  }
}

/** What's on screen, for picking cut points and timing sound. Runs in the page. */
function probe() {
  const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? null;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
  };
  const judges = [...document.querySelectorAll("[data-judge]")]
    .filter(visible)
    .map((el) => `${el.getAttribute("data-judge")}:${el.getAttribute("data-frame")}`);
  const ta = document.querySelector("textarea") as HTMLTextAreaElement | null;
  const input = document.querySelector("#repo") as HTMLInputElement | null;
  const h2 = document.querySelector("h2, h1");
  const words = h2 ? [...h2.querySelectorAll("span")].filter((s) => getComputedStyle(s).opacity === "1").length : 0;
  return {
    step: text("[data-act-step]"),
    odds: [...document.querySelectorAll("p.sr-only")].map((p) => p.textContent?.match(/Chance to win: (\d+) percent/)?.[1]).find(Boolean) ?? null,
    chip: document.querySelector('p[class*="rounded-[6px]"]')?.textContent?.trim() ?? null,
    judges,
    answer: ta?.value.length ?? 0,
    words,
    lines: document.querySelectorAll("svg path").length,
    chat: document.querySelectorAll("li").length,
    button: text("[data-action] button") ?? text("form button[type=submit]"),
    typed: input?.value.length ?? 0,
  };
}

const ready = (page: Page) => page.locator("[data-action] button[data-ready]:not([disabled])");

async function landing(aspect: Aspect) {
  const { browser, page } = await open(aspect, "/");
  const rec = new Recorder(page, join(ROOT, aspect, "landing"));
  // Hero first: the headline words rise in, the judges idle and blink. 7s.
  await rec.record(7 * FPS);
  // Then the repo is typed, about 26 characters a second, and the button pressed.
  const input = page.locator("#repo");
  await input.focus();
  await rec.record(6);
  for (const ch of TYPED_URL) {
    await page.keyboard.type(ch);
    await rec.shot();
    if ((ch.charCodeAt(0) * 7) % 9 === 0) await rec.shot();
  }
  await rec.record(14);
  const btn = page.locator("form button[type=submit]").first();
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await rec.record(4);
  await page.mouse.up();
  await rec.record(40);
  rec.save();
  await browser.close();
}

/** /demo all the way to the share act. `patch` changes the served JS for a variant take. */
async function demo(aspect: Aspect, name: string, opts: { patch?: (js: string) => string; until?: (r: Recorder, page: Page) => Promise<boolean> } = {}) {
  const { browser, page } = await open(aspect, "/demo", opts.patch);
  const rec = new Recorder(page, join(ROOT, aspect, name));
  let readyFor = 0;
  const maxFrames = 75 * FPS;
  while (rec.frame < maxFrames) {
    await rec.shot();
    if (opts.until && (await opts.until(rec, page))) break;
    if (await ready(page).count()) {
      // Hold on the ready button for a beat, the way a person would, then press it.
      if (++readyFor >= 24) {
        const label = await ready(page).innerText();
        if (/share/i.test(label)) {
          // The review: hold on the verdict, then scroll down to the fixes, and stop there.
          console.log(`  ${name} f${rec.frame}: review, scrolling to the fixes`);
          await rec.record(36);
          const target = await page.evaluate(() => {
            const el = document.querySelector("[data-act-scroll]")!;
            const fixes = document.getElementById("fixes")!;
            const top = fixes.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
            return Math.max(0, Math.min(el.scrollHeight - el.clientHeight, top - 24));
          });
          const SCROLL = 30;
          for (let i = 1; i <= SCROLL; i++) {
            const p = i / SCROLL;
            const eased = 1 - Math.pow(1 - p, 3);
            await page.evaluate((y) => document.querySelector("[data-act-scroll]")!.scrollTo({ top: y, behavior: "instant" }), Math.round(target * eased));
            await rec.shot();
          }
          await rec.record(4 * FPS);
          break;
        }
        console.log(`  ${name} f${rec.frame}: press "${label}"`);
        await ready(page).click();
        readyFor = 0;
      }
    } else readyFor = 0;
  }
  rec.save();
  await browser.close();
}

const want = (arg: string | undefined, all: string[]) => (!arg || arg === "all" ? all : arg.split(","));

const aspects = want(process.argv[2], Object.keys(ASPECTS)) as Aspect[];
const takes = want(process.argv[3], ["landing", "demo", "doze"]);

for (const aspect of aspects) {
  for (const take of takes) {
    const t0 = Date.now();
    console.log(`${aspect} ${take}...`);
    if (take === "landing") await landing(aspect);
    if (take === "demo") await demo(aspect, "demo");
    if (take === "doze")
      await demo(aspect, "doze", {
        // The sample team holds off typing on question 3 for 14 seconds.
        patch: (js) =>
          js.replace(
            /const AUTO_START_MS = 700;/,
            "const AUTO_START_MS = 700; const __autoStart = (a) => a && a.startsWith('A Next.js') ? 14000 : 700;",
          ).replace(/setTimeout\(step, reduce \? 0 : AUTO_START_MS\)/, "setTimeout(step, reduce ? 0 : __autoStart(autoAnswer))"),
        // Done once the deliberation starts.
        until: async (r) => r.meta.at(-1)?.step?.includes("3 of 4") ?? false,
      });
    console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
