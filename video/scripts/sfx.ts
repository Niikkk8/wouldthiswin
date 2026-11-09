// The video's sound effects, synthesized: no samples, nothing downloaded, nothing to license.
// Writes 44.1kHz mono WAVs to public/sfx/. Deterministic (seeded noise), so every render
// sounds the same. Usage: npm run sfx

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 44100;
const OUT = join(import.meta.dirname, "..", "public", "sfx");

/** Small seeded PRNG, so the noise is the same every run. */
function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

function wav(samples: Float32Array): Buffer {
  const peak = samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1;
  const gain = 0.5 / peak; // every file peaks at -6 dBFS; the mix sets the level
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x * gain)) * 32767), 44 + i * 2));
  return b;
}

const make = (seconds: number, fn: (t: number, i: number) => number) => {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, i);
  // 2ms fade at both ends: no clicks from the edges themselves.
  const f = Math.round(0.002 * RATE);
  for (let i = 0; i < f; i++) {
    out[i] *= i / f;
    out[n - 1 - i] *= i / f;
  }
  return out;
};

/** State-variable band-pass, for the whoosh's sweep. */
function bandpass(q: number) {
  let low = 0;
  let band = 0;
  return (x: number, hz: number) => {
    const f = 2 * Math.sin((Math.PI * hz) / RATE);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return band;
  };
}

/** A soft key click: a short, bright noise tick with a tiny body. Several, so typing doesn't sound looped. */
function click(variant: number) {
  const rnd = noise(100 + variant);
  const pitch = [2400, 2700, 2200, 2900][variant];
  let prev = 0;
  return make(0.035, (t) => {
    const n = rnd();
    const hp = n - prev; // a one-zero high-pass: just the tick
    prev = n;
    const tick = hp * Math.exp(-t / 0.0025);
    const body = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t / 0.004) * 0.35;
    return tick + body;
  });
}

/** A short whoosh: band-passed noise sweeping up, swelling and falling away. */
function whoosh() {
  const rnd = noise(7);
  const bp = bandpass(0.9);
  const len = 0.42;
  return make(len, (t) => {
    const p = t / len;
    const hz = 350 * Math.pow(3500 / 350, p);
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.15)), 2);
    return bp(rnd(), hz) * env;
  });
}

/** A low thud: a sine falling from 110Hz to 42Hz under a muffled knock. */
function thud() {
  const rnd = noise(11);
  let lp = 0;
  let phase = 0;
  return make(0.6, (t) => {
    const hz = 42 + 68 * Math.exp(-t / 0.06);
    phase += (2 * Math.PI * hz) / RATE;
    const body = Math.sin(phase) * Math.exp(-t / 0.16);
    lp += 0.08 * (rnd() - lp);
    const knock = lp * Math.exp(-t / 0.012) * 3;
    return body + knock;
  });
}

/** A light tap: a short, round two-partial blip. */
function tap() {
  return make(0.16, (t) => {
    const env = Math.exp(-t / 0.035);
    return (Math.sin(2 * Math.PI * 660 * t) + 0.4 * Math.sin(2 * Math.PI * 1320 * t)) * env * (1 - Math.exp(-t / 0.0015));
  });
}

/** A soft chime: a C major dyad with a gentle bell overtone. */
function chime() {
  const partials = [
    { hz: 1046.5, amp: 1, decay: 0.9 },
    { hz: 1568, amp: 0.6, decay: 0.7 },
    { hz: 2093, amp: 0.25, decay: 0.45 },
    { hz: 3140, amp: 0.08, decay: 0.25 },
  ];
  return make(2.2, (t) => {
    const attack = 1 - Math.exp(-t / 0.006);
    return partials.reduce((s, p) => s + p.amp * Math.sin(2 * Math.PI * p.hz * t) * Math.exp(-t / p.decay), 0) * attack;
  });
}

mkdirSync(OUT, { recursive: true });
const files: Record<string, Float32Array> = {
  "click-0": click(0),
  "click-1": click(1),
  "click-2": click(2),
  "click-3": click(3),
  whoosh: whoosh(),
  thud: thud(),
  tap: tap(),
  chime: chime(),
};
for (const [name, s] of Object.entries(files)) writeFileSync(join(OUT, `${name}.wav`), wav(s));
console.log(`wrote ${Object.keys(files).length} sounds to ${OUT}`);
