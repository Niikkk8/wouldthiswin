import { ImageResponse } from "next/og";
import { copy } from "@/lib/copy";
import { LOGO_RATIO, logoDataUri } from "@/lib/logo";
import { ogFonts } from "@/lib/og-fonts";

// The landing page's share card. Review links set their own (app/og/[id]).
export const alt = `${copy.meta.title}. ${copy.meta.description}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = { bg: "#0A0A0B", text: "#F4F4F2", muted: "#B5B5B8", subtle: "#8A8A8E", gain: "#4D7CFF", loss: "#FF3B30", border: "#2A2A2E" };

/** A made-up night, drawn only as a shape: up on the scan, down on an answer, up again. */
const SPARK = [50, 56, 62, 43, 47, 41, 52, 61];

/** The card never changes, so it's drawn once at build time and served as a static file. */
export default async function Image() {
  return new Response(await draw(), { headers: { "content-type": contentType } });
}

async function draw(): Promise<ArrayBuffer> {
  "use cache";
  const [fonts, logo] = await Promise.all([ogFonts(), logoDataUri()]);
  const W = 420;
  const H = 120;
  const x = (i: number) => 6 + (i / (SPARK.length - 1)) * (W - 12);
  const y = (o: number) => 6 + (1 - (o - 30) / 40) * (H - 12);
  const d = SPARK.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: C.bg, color: C.text, padding: "64px 72px", fontFamily: "Archivo" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={logo} width={54} height={Math.round(54 * LOGO_RATIO)} />
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{copy.brand}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 48, fontSize: 132, fontWeight: 900, letterSpacing: -6, lineHeight: 0.88 }}>
          <div style={{ display: "flex" }}>Would this</div>
          <div style={{ display: "flex" }}>win?</div>
        </div>
        <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", maxWidth: 620, fontSize: 30, lineHeight: 1.3, color: C.muted, fontWeight: 800 }}>
            {copy.landing.subhead}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <line x1={0} x2={W} y1={y(50)} y2={y(50)} stroke={C.border} strokeWidth={2} strokeDasharray="4 6" />
              <path d={d} fill="none" stroke={C.text} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(SPARK.length - 1)} cy={y(SPARK.at(-1)!)} r={8} fill={C.gain} stroke={C.bg} strokeWidth={3} />
            </svg>
            <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 24, color: C.subtle }}>wouldthiswin.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  ).arrayBuffer();
}
