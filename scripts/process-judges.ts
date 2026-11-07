// Turns the generated judge art into the sprites the app uses. Re-runnable:
//
//   npm run judges
//
// Reads public/judges/<judge>/<frame>.png (2048x2048, drawn on a 128x128 pixel grid) and
// writes, per judge:
//   public/judges/<judge>-sheet.png  every frame side by side, 128x128 each, in FRAMES order
//   public/judges/<judge>-head.png   the HEAD_CROP square of the base frame
//   lib/judge-heads.ts               the heads as data URIs, for the share card
//   .judge-previews/<judge>.png      every frame at 4x with its name, to check by eye
//
// Per frame: find the offset that lines it up with the judge's base frame, sample the
// centre of each grid block on the base frame's grid, then repaint the blocks under the
// generator's sparkle watermark (bottom right) with the colour underneath it.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FRAMES, HEAD_CROP, SPRITE_SIZE } from "../lib/judge-sprites";
import { JUDGES, type Judge } from "../lib/session";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public/judges");
const PREVIEW = path.join(ROOT, ".judge-previews");
const N = SPRITE_SIZE;

/** The page background; watermark blocks over background are painted with it. */
const BG: RGB = [0x0a, 0x0a, 0x0b];

/** The sparkle: a four-point star, white at 50% over the art, centred here on the 2048 source. */
const STAR = { cx: 1936, cy: 1936, r: 48, alpha: 0.5, pad: 3 };

type RGB = [number, number, number];
type Img = { w: number; h: number; data: Uint8Array };

async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    w: info.width,
    h: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
  };
}

const at = (img: Img, x: number, y: number, c: number) => {
  const cx = Math.min(img.w - 1, Math.max(0, x));
  const cy = Math.min(img.h - 1, Math.max(0, y));
  return img.data[(cy * img.w + cx) * 3 + c];
};

function inStar(x: number, y: number, pad = 0): boolean {
  const r = STAR.r + pad;
  const dx = Math.abs(x - STAR.cx) / r;
  const dy = Math.abs(y - STAR.cy) / r;
  // An astroid-like curve: concave sides, points on the axes.
  return dx <= 1 && dy <= 1 && Math.pow(dx, 0.7) + Math.pow(dy, 0.7) <= 1;
}

// ---------- the grid ----------

type Grid = { pitch: number; ox: number; oy: number };

/** The grid whose block edges line up with the most colour change in the base frame. */
function findGrid(img: Img): Grid {
  const ex = new Float64Array(img.w);
  const ey = new Float64Array(img.h);
  for (let y = 1; y < img.h; y++)
    for (let x = 1; x < img.w; x++)
      for (let c = 0; c < 3; c++) {
        const v = at(img, x, y, c);
        ex[x] += Math.abs(v - at(img, x - 1, y, c));
        ey[y] += Math.abs(v - at(img, x, y - 1, c));
      }
  const fit = (e: Float64Array, pitch: number) => {
    let best = { score: -1, o: 0 };
    for (let o = 0; o < Math.ceil(pitch); o++) {
      let s = 0;
      let n = 0;
      for (let k = 0; ; k++) {
        const x = Math.round(o + k * pitch);
        if (x >= e.length) break;
        s += e[x];
        n++;
      }
      if (s / n > best.score) best = { score: s / n, o };
    }
    return best;
  };
  let best = { score: -1, grid: { pitch: img.w / N, ox: 0, oy: 0 } };
  for (const pitch of [15.95, 16, 16.05]) {
    const fx = fit(ex, pitch);
    const fy = fit(ey, pitch);
    const score = fx.score + fy.score;
    if (score > best.score) best = { score, grid: { pitch, ox: fx.o, oy: fy.o } };
  }
  // Start the grid at the block edge nearest 0, so block 0 is the leftmost whole-ish block.
  const g = best.grid;
  const wrap = (o: number) => (o > g.pitch / 2 ? o - g.pitch : o);
  return { pitch: g.pitch, ox: wrap(g.ox), oy: wrap(g.oy) };
}

const centre = (g: Grid, k: number, o: number) => Math.round(o + g.pitch * k + g.pitch / 2);

// ---------- alignment ----------

function gray(img: Img, scale: number): { w: number; h: number; v: Float32Array } {
  const w = Math.floor(img.w / scale);
  const h = Math.floor(img.h / scale);
  const v = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let yy = 0; yy < scale; yy++)
        for (let xx = 0; xx < scale; xx++) {
          const sx = x * scale + xx;
          const sy = y * scale + yy;
          s += at(img, sx, sy, 0) + at(img, sx, sy, 1) + at(img, sx, sy, 2);
        }
      v[y * w + x] = s / (3 * scale * scale);
    }
  return { w, h, v };
}

/** The (dx, dy) for which frame(x + dx, y + dy) best matches base(x, y), in source pixels. */
function align(base: Img, frame: Img): { dx: number; dy: number } {
  const S = 4;
  const gb = gray(base, S);
  const gf = gray(frame, S);
  const R = 16;
  const cost = (dx: number, dy: number, step: number) => {
    let s = 0;
    let n = 0;
    for (let y = R; y < gb.h - R; y += step)
      for (let x = R; x < gb.w - R; x += step) {
        if (inStar(x * S, y * S, 40)) continue;
        s += Math.abs(gb.v[y * gb.w + x] - gf.v[(y + dy) * gf.w + (x + dx)]);
        n++;
      }
    return s / n;
  };
  let best = { c: Infinity, dx: 0, dy: 0 };
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const c = cost(dx, dy, 2);
      if (c < best.c) best = { c, dx, dy };
    }
  // Refine to the source pixel.
  const fine = (dx: number, dy: number) => {
    let s = 0;
    let n = 0;
    for (let y = 64; y < base.h - 64; y += 5)
      for (let x = 64; x < base.w - 64; x += 5) {
        if (inStar(x, y, 40)) continue;
        for (let c = 0; c < 3; c++) s += Math.abs(at(base, x, y, c) - at(frame, x + dx, y + dy, c));
        n++;
      }
    return s / n;
  };
  let out = { c: Infinity, dx: 0, dy: 0 };
  for (let dy = best.dy * S - S; dy <= best.dy * S + S; dy++)
    for (let dx = best.dx * S - S; dx <= best.dx * S + S; dx++) {
      const c = fine(dx, dy);
      if (c < out.c) out = { c, dx, dy };
    }
  return { dx: out.dx, dy: out.dy };
}

// ---------- snapping and the watermark ----------

const HALF = 3; // the sample window is 7x7 source pixels around each block centre

function median(xs: number[]): number {
  xs.sort((a, b) => a - b);
  return xs[xs.length >> 1];
}

/** Samples the centre of every grid block. Returns the 128x128 pixels and which blocks the star touches. */
function snap(frame: Img, g: Grid, d: { dx: number; dy: number }) {
  const px: RGB[] = [];
  const touched: boolean[] = [];
  for (let by = 0; by < N; by++)
    for (let bx = 0; bx < N; bx++) {
      const cx = centre(g, bx, g.ox) + d.dx;
      const cy = centre(g, by, g.oy) + d.dy;
      const ch: number[][] = [[], [], []];
      let star = false;
      for (let y = cy - HALF; y <= cy + HALF; y++)
        for (let x = cx - HALF; x <= cx + HALF; x++) {
          for (let c = 0; c < 3; c++) ch[c].push(at(frame, x, y, c));
          if (inStar(x, y, STAR.pad)) star = true;
        }
      px.push([median(ch[0]), median(ch[1]), median(ch[2])]);
      touched.push(star);
    }
  return { px, touched };
}

/** Distance from `o` to the colours `p` takes under the star at any strength up to full. */
function underStar(o: RGB, p: RGB): number {
  let best = Infinity;
  for (let a = 0; a <= STAR.alpha + 1e-9; a += 0.05) {
    let s = 0;
    for (let c = 0; c < 3; c++) {
      const v = p[c] + a * (255 - p[c]);
      s += (o[c] - v) ** 2;
    }
    best = Math.min(best, s);
  }
  return best;
}

const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * Repaints the blocks under the star. Each takes the colour from the untouched blocks nearby
 * that, under 50% white, best explains what's there; background becomes #0A0A0B. Nothing
 * else changes.
 */
function removeStar(px: RGB[], touched: boolean[], bg: RGB): number {
  const idx = touched.flatMap((t, i) => (t ? [i] : []));
  if (!idx.length) return 0;
  const xs = idx.map((i) => i % N);
  const ys = idx.map((i) => Math.floor(i / N));
  const pad = 4;
  const palette: RGB[] = [];
  for (let y = Math.max(0, Math.min(...ys) - pad); y <= Math.min(N - 1, Math.max(...ys) + pad); y++)
    for (
      let x = Math.max(0, Math.min(...xs) - pad);
      x <= Math.min(N - 1, Math.max(...xs) + pad);
      x++
    ) {
      const i = y * N + x;
      if (touched[i]) continue;
      if (!palette.some((p) => dist2(p, px[i]) < 9)) palette.push(px[i]);
    }
  for (const i of idx) {
    let best = { d: Infinity, p: px[i] };
    for (const p of palette) {
      const d = underStar(px[i], p);
      if (d < best.d) best = { d, p };
    }
    px[i] = dist2(best.p, bg) < 15 * 15 ? [...BG] : best.p;
  }
  return idx.length;
}

// ---------- output ----------

function raw(px: RGB[]): Buffer {
  const b = Buffer.alloc(px.length * 3);
  px.forEach((p, i) => b.set(p, i * 3));
  return b;
}

const rgbPng = (buf: Buffer, w: number, h: number) =>
  sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 9 });

async function processJudge(judge: Judge) {
  const frames = FRAMES[judge] as readonly string[];
  const imgs = await Promise.all(frames.map((f) => load(path.join(SRC, judge, `${f}.png`))));
  const base = imgs[0];
  if (base.w !== base.h) throw new Error(`${judge}/base.png isn't square`);
  const grid = findGrid(base);
  // The background, read from the base frame's top-left corner.
  const bg = snap(base, grid, { dx: 0, dy: 0 }).px[2 * N + 2];
  console.log(
    `${judge}: grid pitch ${grid.pitch}, offset ${grid.ox},${grid.oy}; background ${bg.join(",")}`,
  );

  const sprites: RGB[][] = [];
  for (let i = 0; i < frames.length; i++) {
    const d = i === 0 ? { dx: 0, dy: 0 } : align(base, imgs[i]);
    const { px, touched } = snap(imgs[i], grid, d);
    const fixed = removeStar(px, touched, bg);
    sprites.push(px);
    console.log(`  ${frames[i].padEnd(12)} shift ${d.dx},${d.dy}  watermark blocks ${fixed}`);
  }

  // The sheet: frames left to right.
  const W = N * frames.length;
  const sheet = Buffer.alloc(W * N * 3);
  sprites.forEach((px, f) => {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) sheet.set(px[y * N + x], (y * W + f * N + x) * 3);
  });
  await rgbPng(sheet, W, N).toFile(path.join(SRC, `${judge}-sheet.png`));

  const h = HEAD_CROP[judge];
  const head = await rgbPng(raw(sprites[0]), N, N)
    .extract({ left: h.x, top: h.y, width: h.size, height: h.size })
    .toBuffer();
  await sharp(head).toFile(path.join(SRC, `${judge}-head.png`));

  // The preview: every frame at 4x with its name.
  const S = 4;
  const gap = 16;
  const label = 40;
  const tiles = await Promise.all(
    sprites.map((px) =>
      rgbPng(raw(px), N, N)
        .resize(N * S, N * S, { kernel: "nearest" })
        .toBuffer(),
    ),
  );
  const pw = frames.length * (N * S + gap) + gap;
  const ph = N * S + label + gap * 2;
  const text = frames
    .map(
      (f, i) =>
        `<text x="${gap + i * (N * S + gap)}" y="${gap + 26}" fill="#f4f4f2" font-family="monospace" font-size="26">${f}</text>`,
    )
    .join("");
  await sharp({ create: { width: pw, height: ph, channels: 3, background: "#2a2a2e" } })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">${text}</svg>`,
        ),
        left: 0,
        top: 0,
      },
      ...tiles.map((t, i) => ({ input: t, left: gap + i * (N * S + gap), top: gap + label })),
    ])
    .png()
    .toFile(path.join(PREVIEW, `${judge}.png`));

  return `data:image/png;base64,${head.toString("base64")}`;
}

async function main() {
  fs.mkdirSync(PREVIEW, { recursive: true });
  const heads: Record<string, string> = {};
  for (const judge of JUDGES) heads[judge] = await processJudge(judge);
  const ts = [
    "// Generated by scripts/process-judges.ts. Don't edit; run `npm run judges`.",
    "// Each judge's head, cropped from the base frame, as a PNG data URI for the share card.",
    "",
    'import type { Judge } from "./session";',
    "",
    "export const JUDGE_HEADS: Record<Judge, string> = {",
    ...JUDGES.map((j) => `  ${j}: "${heads[j]}",`),
    "};",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, "lib/judge-heads.ts"), ts);
  console.log(`Previews in ${PREVIEW}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
