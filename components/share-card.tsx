import { copy } from "@/lib/copy";
import { JUDGE_FACES, JUDGE_HEADS } from "@/lib/judge-heads";
import { CARD_HEAD, type FaceSize } from "@/lib/judge-sprites";
import type { Review } from "@/lib/review";
import type { ReviewStatus } from "@/lib/session";

export type CardFonts = { sans: string; mono: string };
/** The names the OG route registers its fonts under. */
export const OG_FONTS: CardFonts = { sans: "Archivo", mono: "JetBrains Mono" };
/** The site's own fonts, for the card drawn in a page. */
export const PAGE_FONTS: CardFonts = { sans: "var(--font-archivo), sans-serif", mono: "var(--font-jetbrains), monospace" };

// The share images: the review at a glance, in the dark system. They're what people post,
// so everything important is large enough to read as a thumbnail.
//
// "og" is the review link's preview (1200x630). The others are made to be posted:
// landscape for X and LinkedIn, portrait for an Instagram post, story for Instagram and
// WhatsApp stories (laid out inside the story safe area, clear of the apps' own bars).

export const SHARE_FORMATS = {
  og: { width: 1200, height: 630 },
  landscape: { width: 1200, height: 675 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;
export type ShareFormat = keyof typeof SHARE_FORMATS;
/** The ones people download and post. */
export const POST_FORMATS = ["landscape", "portrait", "story"] as const satisfies readonly ShareFormat[];
export type PostFormat = (typeof POST_FORMATS)[number];

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

/**
 * The card. The OG route renders it with satori (font names as registered there); pages
 * render it in the browser with their own font stacks.
 */
export function ShareCard({ r, format = "og", fonts = OG_FONTS }: { r: Review; format?: ShareFormat; fonts?: CardFonts }) {
  if (format === "landscape") return <Landscape r={r} fonts={fonts} />;
  if (format === "portrait" || format === "story") return <Tall r={r} fonts={fonts} story={format === "story"} />;
  return <Og r={r} fonts={fonts} />;
}

/** 1200x630, the review link's preview. */
function Og({ r, fonts }: { r: Review; fonts: CardFonts }) {
  // Up to four checks, passed or failed; failures first, since they're the story.
  const checks = [...r.checks.filter((c) => c.status === "failed"), ...r.checks.filter((c) => c.status === "passed")].slice(0, 4);
  return (
    <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: C.bg, color: C.text, padding: "52px 64px", fontFamily: fonts.sans }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
          <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 22, color: C.subtle }}>{clip(r.repo, 48)}</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginTop: 10 }}>
            {clip(projectName(r.repo), 18)}
          </div>
          <div style={{ display: "flex", marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                fontFamily: fonts.mono,
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

      <div style={{ display: "flex", marginTop: "auto", gap: 28, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 800 }}>
              <MarkIcon mark={c.status === "passed" ? "check" : "cross"} color={c.status === "passed" ? C.gain : C.loss} />
              <div style={{ display: "flex", color: C.muted }}>{clip(c.title, 26)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: "auto" }}>
          {r.reviewers.map((rv) => (
            <div key={rv.judge} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: fonts.mono, fontSize: 21 }}>
              <MarkIcon mark={REVIEWER[rv.status].mark} color={REVIEWER[rv.status].color} size={20} />
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={JUDGE_HEADS[rv.judge]} width={CARD_HEAD} height={CARD_HEAD} style={{ borderRadius: 999, imageRendering: "pixelated" }} />
              <div style={{ display: "flex", color: C.muted }}>{copy.judges[rv.judge].name}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <Spark points={r.spark} />
          <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 22, color: C.subtle }}>wouldthiswin.com</div>
        </div>
      </div>
    </div>
  );
}

/** The verdict pill: Ready to win, or Changes requested. */
function Pill({ r, fonts, size }: { r: Review; fonts: CardFonts; size: number }) {
  return (
    <div style={{ display: "flex" }}>
      <div
        style={{
          display: "flex",
          fontFamily: fonts.mono,
          fontSize: size,
          padding: `${Math.round(size / 3)}px ${Math.round(size * 0.75)}px`,
          borderRadius: 999,
          background: r.readyToWin ? C.gain : C.loss,
          color: C.bg,
        }}
      >
        {r.readyToWin ? copy.review.ready : copy.review.changes}
      </div>
    </div>
  );
}

/** The three judges, whole, each with how they reviewed it. */
function Panel({ r, fonts, size, gap, label }: { r: Review; fonts: CardFonts; size: FaceSize; gap: number; label: number }) {
  return (
    <div style={{ display: "flex", gap }}>
      {r.reviewers.map((rv) => (
        <div key={rv.judge} style={{ display: "flex", flexDirection: "column", minWidth: size + 4 }}>
          <div style={{ display: "flex", width: size + 4, borderRadius: 16, border: `2px solid ${C.border}`, background: C.surface, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={JUDGE_FACES[size][rv.judge]} width={size} height={size} style={{ imageRendering: "pixelated" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontFamily: fonts.mono, fontSize: label, color: C.muted, whiteSpace: "nowrap" }}>
            <MarkIcon mark={REVIEWER[rv.status].mark} color={REVIEWER[rv.status].color} size={Math.round(label * 0.95)} />
            {copy.review.reviewerStatus[rv.status]}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 1200x675, for X and LinkedIn. */
function Landscape({ r, fonts }: { r: Review; fonts: CardFonts }) {
  return (
    <div style={{ width: 1200, height: 675, display: "flex", flexDirection: "column", background: C.bg, color: C.text, padding: "52px 64px 44px", fontFamily: fonts.sans }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 22, color: C.subtle }}>{clip(r.repo, 48)}</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginTop: 10 }}>
            {clip(projectName(r.repo), 17)}
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1, lineHeight: 1.15, marginTop: 22 }}>
            &ldquo;{clip(r.oneLiner, 70)}&rdquo;
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 176, fontWeight: 900, letterSpacing: -9, lineHeight: 0.9 }}>{r.odds}%</div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, marginTop: 8 }}>{copy.tiers[r.tier]}</div>
          <div style={{ display: "flex", marginTop: 16 }}>
            <Pill r={r} fonts={fonts} size={22} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Panel r={r} fonts={fonts} size={128} gap={24} label={18} />
        <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 24, color: C.subtle }}>wouldthiswin.com</div>
      </div>
    </div>
  );
}

/**
 * 1080x1350 (an Instagram post) and 1080x1920 (a story): the odds huge, the judges below.
 * A story keeps everything between 250px from the top and 260px from the bottom, where the
 * apps draw their own bars and reply box.
 */
function Tall({ r, fonts, story }: { r: Review; fonts: CardFonts; story: boolean }) {
  return (
    <div
      style={{
        width: 1080,
        height: story ? 1920 : 1350,
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        color: C.text,
        padding: story ? "250px 84px 260px" : "80px 84px 72px",
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: 28, color: C.subtle }}>{clip(r.repo, 44)}</div>
      <div style={{ display: "flex", fontSize: story ? 104 : 92, fontWeight: 900, letterSpacing: -4, lineHeight: 1, marginTop: 12 }}>
        {clip(projectName(r.repo), 16)}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: story ? 400 : 300,
          fontWeight: 900,
          letterSpacing: story ? -22 : -16,
          lineHeight: 0.86,
          marginTop: story ? 64 : 44,
          marginLeft: -12,
        }}
      >
        {r.odds}%
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: story ? 36 : 26 }}>
        <div style={{ display: "flex", fontSize: story ? 52 : 44, fontWeight: 800, letterSpacing: -1 }}>{copy.tiers[r.tier]}</div>
        <Pill r={r} fonts={fonts} size={story ? 28 : 24} />
      </div>
      <div style={{ display: "flex", fontSize: story ? 52 : 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.12, marginTop: story ? 56 : 36 }}>
        &ldquo;{clip(r.oneLiner, 90)}&rdquo;
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <Panel r={r} fonts={fonts} size={256} gap={36} label={21} />
        <div style={{ display: "flex", fontFamily: fonts.mono, fontSize: story ? 34 : 28, color: C.subtle, marginTop: story ? 56 : 40 }}>
          wouldthiswin.com
        </div>
      </div>
    </div>
  );
}
