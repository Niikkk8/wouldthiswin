// Fonts for the share card. Satori needs TTF/OTF data, so they're fetched from Google Fonts
// once per server instance (the CSS API serves TTF to clients that don't ask for woff2).

type Font = { name: string; data: ArrayBuffer; weight: 500 | 800 | 900; style: "normal" };

const FAMILIES = [
  { name: "Archivo", query: "Archivo:wght@800;900", weights: [800, 900] as const },
  { name: "JetBrains Mono", query: "JetBrains+Mono:wght@500", weights: [500] as const },
];

async function load(): Promise<Font[]> {
  const fonts: Font[] = [];
  for (const f of FAMILIES) {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${f.query}`, {
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.text());
    // One @font-face per weight; take the latin subset (the last block per weight).
    for (const w of f.weights) {
      const blocks = css.split("@font-face").filter((b) => b.includes(`font-weight: ${w}`));
      const url = blocks.at(-1)?.match(/src:\s*url\(([^)]+)\)/)?.[1];
      if (!url) continue;
      const data = await fetch(url, { signal: AbortSignal.timeout(5000) }).then((r) => r.arrayBuffer());
      fonts.push({ name: f.name, data, weight: w, style: "normal" });
    }
  }
  return fonts;
}

let cached: Promise<Font[]> | null = null;

/** Never throws: without the fonts, the card falls back to the default face. */
export function ogFonts(): Promise<Font[]> {
  cached ??= load().catch((err) => {
    console.warn(JSON.stringify({ event: "og.fonts", error: String(err) }));
    cached = null;
    return [];
  });
  return cached;
}
