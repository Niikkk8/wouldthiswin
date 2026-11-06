import type { CSSProperties } from "react";
import { copy } from "@/lib/copy";

/**
 * The event badge in its plastic sleeve. Flexbox, inline styles and plain
 * shapes only, so the same component renders in next/og (Satori), where CSS
 * variables and classes aren't available: callers pass font family names in.
 */

export type BadgeFonts = { sans: string; marker: string };

export const WEB_FONTS: BadgeFonts = {
  sans: "var(--font-sans)",
  marker: "var(--font-marker)",
};

export const BADGE_COLORS = {
  board: "#f5f7f7",
  ink: "#000000",
  graphite: "#4a5560",
  sleeve: "#dde3e6",
  sleeveEdge: "#b9c3c9",
  lanyard: "#2d5be3",
  card: "#ffffff",
};

/** Average advance of Schibsted Grotesk Bold, in em. Slightly generous so text never clips. */
const BOLD_CHAR_EM = 0.6;

/** Largest font size (up to `max`) that keeps `text` on one line within `available` px. */
function fitFontSize(text: string, available: number, max: number) {
  return Math.max(10, Math.min(max, Math.floor(available / (text.length * BOLD_CHAR_EM))));
}

type Props = {
  role?: string;
  title: string;
  subtitle?: string;
  overall?: number;
  verdict?: string;
  width?: number;
  fonts?: BadgeFonts;
};

export function Badge({
  role = copy.badge.role,
  title,
  subtitle,
  overall,
  verdict,
  width = 260,
  fonts = WEB_FONTS,
}: Props) {
  const s = width / 260;
  const px = (n: number) => Math.round(n * s);
  const c = BADGE_COLORS;
  const flexCol: CSSProperties = { display: "flex", flexDirection: "column" };

  const bodyPadX = px(14);
  const textWidth = width - px(9) * 2 - bodyPadX * 2 - 4;
  const titleSize = fitFontSize(title, textWidth, px(overall === undefined ? 30 : 22));

  return (
    <div
      style={{
        ...flexCol,
        width,
        padding: px(9),
        paddingTop: px(12),
        borderRadius: px(14),
        background: c.sleeve,
        border: `${Math.max(1, px(1.5))}px solid ${c.sleeveEdge}`,
        fontFamily: fonts.sans,
      }}
    >
      {/* slot the lanyard clip goes through */}
      <div
        style={{
          display: "flex",
          alignSelf: "center",
          width: px(46),
          height: px(8),
          borderRadius: px(4),
          background: c.board,
          border: `${Math.max(1, px(1))}px solid ${c.sleeveEdge}`,
          marginBottom: px(10),
        }}
      />
      <div style={{ ...flexCol, background: c.card, borderRadius: px(6), overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            background: c.lanyard,
            color: c.card,
            padding: `${px(9)}px ${bodyPadX}px`,
            fontSize: px(19),
            fontWeight: 800,
            letterSpacing: px(5),
          }}
        >
          {role}
        </div>

        <div style={{ ...flexCol, padding: `${px(16)}px ${bodyPadX}px ${px(14)}px` }}>
          {subtitle && (
            <div style={{ display: "flex", fontSize: px(13), color: c.graphite }}>{subtitle}</div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.15,
              color: c.ink,
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>

          {overall !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                marginTop: px(14),
                fontFamily: fonts.marker,
                color: c.ink,
              }}
            >
              <span style={{ fontSize: px(64), lineHeight: 1 }}>{overall}</span>
              <span
                style={{
                  fontFamily: fonts.sans,
                  fontSize: px(17),
                  fontWeight: 600,
                  marginLeft: px(6),
                  color: c.graphite,
                }}
              >
                /100
              </span>
            </div>
          )}

          {verdict && (
            <div
              style={{
                display: "flex",
                marginTop: px(8),
                fontSize: px(17),
                fontWeight: 700,
                lineHeight: 1.2,
                color: c.ink,
              }}
            >
              {verdict}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            borderTop: `1px solid ${c.sleeve}`,
            padding: `${px(8)}px ${bodyPadX}px`,
            fontSize: px(12),
            color: c.graphite,
          }}
        >
          {copy.badge.event}
        </div>
      </div>
    </div>
  );
}
