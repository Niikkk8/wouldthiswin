import { ImageResponse } from "next/og";
import { copy } from "@/lib/copy";
import { ogFonts } from "@/lib/og-fonts";
import { loadPublicReview } from "@/lib/session-store";
import type { Review } from "@/lib/review";
import type { ReviewStatus } from "@/lib/session";

// The share card: the review at a glance, 1200x630, in the dark system. It's the image
// people post, so everything important is large enough to read as a thumbnail.

const C = {
  bg: "#0A0A0B",
  surface: "#141416",
  border: "#2A2A2E",
  text: "#F4F4F2",
  muted: "#B5B5B8",
  subtle: "#8A8A8E",
  gain: "#4D7CFF",
  loss: "#FF3B30",
  unclear: "#F5A524",
};

type Mark = "check" | "cross" | "dot";

const REVIEWER: Record<ReviewStatus, { mark: Mark; color: string }> = {
  approved: { mark: "check", color: C.gain },
  changesRequested: { mark: "cross", color: C.loss },
  commented: { mark: "dot", color: C.muted },
};

/** Drawn, not typed: the card's fonts have no check mark glyph. */
function MarkIcon({ mark, color, size = 22 }: { mark: Mark; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {mark === "check" && <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />}
      {mark === "cross" && <path d="M6 6l12 12M18 6L6 18" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" />}
      {mark === "dot" && <circle cx={12} cy={12} r={4.5} fill={color} />}
    </svg>
  );
}

const projectName = (repo: string) => repo.split("/").pop() ?? repo;
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function Spark({ points }: { points: number[] }) {
  const W = 360;
  const H = 96;
  const n = Math.max(1, points.length - 1);
  const x = (i: number) => 4 + (i / n) * (W - 8);
  const y = (o: number) => 4 + (1 - o / 100) * (H - 8);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const last = points.at(-1) ?? 50;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <line x1={0} x2={W} y1={y(50)} y2={y(50)} stroke={C.border} strokeWidth={2} strokeDasharray="4 6" />
      <path d={d} fill="none" stroke={C.text} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n)} cy={y(last)} r={7} fill={last >= 50 ? C.gain : C.loss} stroke={C.bg} strokeWidth={3} />
    </svg>
  );
}

function Card({ r }: { r: Review }) {
  // Up to four checks, passed or failed; failures first, since they're the story.
  const checks = [...r.checks.filter((c) => c.status === "failed"), ...r.checks.filter((c) => c.status === "passed")].slice(0, 4);
  return (
    <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: C.bg, color: C.text, padding: "52px 64px", fontFamily: "Archivo" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 22, color: C.subtle }}>{clip(r.repo, 48)}</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginTop: 10 }}>
            {clip(projectName(r.repo), 18)}
          </div>
          <div style={{ display: "flex", marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono",
                fontSize: 24,
                padding: "8px 18px",
                borderRadius: 999,
                background: r.readyToWin ? C.gain : C.loss,
                color: C.bg,
              }}
            >
              {r.readyToWin ? copy.review.ready : copy.review.changes}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 176, fontWeight: 900, letterSpacing: -9, lineHeight: 0.9 }}>{r.odds}%</div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, marginTop: 8 }}>{copy.tiers[r.tier]}</div>
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 38, fontWeight: 800, letterSpacing: -1, marginTop: 30, color: C.text }}>
        &ldquo;{clip(r.oneLiner, 60)}&rdquo;
      </div>

      <div style={{ display: "flex", marginTop: "auto", gap: 44, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 800 }}>
              <MarkIcon mark={c.status === "passed" ? "check" : "cross"} color={c.status === "passed" ? C.gain : C.loss} />
              <div style={{ display: "flex", color: C.muted }}>{clip(c.title, 30)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: "auto" }}>
          {r.reviewers.map((rv) => (
            <div key={rv.judge} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "JetBrains Mono", fontSize: 21 }}>
              <MarkIcon mark={REVIEWER[rv.status].mark} color={REVIEWER[rv.status].color} size={20} />
              <div style={{ display: "flex", color: C.muted }}>{copy.judges[rv.judge].name}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <Spark points={r.spark} />
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 22, color: C.subtle }}>wouldthiswin.com</div>
        </div>
      </div>
    </div>
  );
}

export async function GET(_req: Request, ctx: RouteContext<"/og/[id]">) {
  const { id } = await ctx.params;
  const review = await loadPublicReview(id).catch(() => null);
  if (!review) return new Response("Not found", { status: 404 });
  const fonts = await ogFonts();
  return new ImageResponse(<Card r={review} />, {
    width: 1200,
    height: 630,
    fonts,
    headers: { "cache-control": "public, max-age=3600, s-maxage=3600" },
  });
}
