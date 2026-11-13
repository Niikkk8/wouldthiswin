import { copy } from "@/lib/copy";
import { JUDGE_FACES } from "@/lib/judge-heads";
import type { Review } from "@/lib/review";
import { REVIEW_ORDER } from "@/lib/review";

// The shared verdict's preview card (1200x630), drawn by next/og: the repo, the odds large,
// the status, the three judges and one line from the Tired Judge. Inline styles only, since
// next/og renders a subset of CSS.

const C = { bg: "#0A0A0B", surface: "#141416", border: "#2A2A2E", text: "#F4F4F2", muted: "#B5B5B8", subtle: "#8A8A8E", gain: "#4D7CFF", loss: "#FF3B30" };

const projectName = (repo: string) => repo.split("/").pop() ?? repo;

/** The Tired Judge's line: their own review comment if it's short enough to read as a thumbnail, else a stock one. */
export function tiredLine(r: Review): string {
  const own = r.comments.find((c) => c.judge === "tired")?.body;
  return own && own.length <= 90 ? own : copy.verdict.cardLine[r.tier];
}

export function VerdictCard({ r, delta }: { r: Review; delta: number | null }) {
  const name = projectName(r.repo);
  const nameSize = name.length > 22 ? 52 : name.length > 14 ? 64 : 76;
  return (
    <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: C.bg, color: C.text, padding: "56px 64px", fontFamily: "Archivo" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 24, color: C.subtle }}>{r.repo.length > 44 ? `${r.repo.slice(0, 43)}…` : r.repo}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: nameSize, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{name.length > 32 ? `${name.slice(0, 31)}…` : name}</div>
          <div style={{ display: "flex", marginTop: 24 }}>
            <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: r.readyToWin ? C.gain : C.loss, color: C.bg, fontFamily: "JetBrains Mono", fontSize: 24, fontWeight: 500 }}>
              {r.readyToWin ? copy.review.ready : copy.review.changes}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 196, fontWeight: 900, letterSpacing: -10, lineHeight: 0.86 }}>{r.odds}%</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 30, fontWeight: 800 }}>{copy.tiers[r.tier]}</div>
          {delta !== null && delta !== 0 && (
            <div style={{ display: "flex", marginTop: 10, fontFamily: "JetBrains Mono", fontSize: 26, color: delta > 0 ? C.gain : C.loss }}>
              {`${r.odds - delta}% → ${r.odds}%`}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {REVIEW_ORDER.map((j) => (
              <div key={j} style={{ display: "flex", width: 132, height: 132, borderRadius: 16, border: `2px solid ${C.border}`, background: C.surface, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                <img src={JUDGE_FACES[128][j]} width={128} height={128} style={{ imageRendering: "pixelated" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 380 }}>
            <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 18, color: C.subtle, textTransform: "uppercase" }}>{copy.judges.tired.name}</div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>{tiredLine(r)}</div>
          </div>
        </div>
        <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 22, color: C.subtle }}>wouldthiswin.com</div>
      </div>
    </div>
  );
}
