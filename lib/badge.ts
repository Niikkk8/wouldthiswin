// The README badge: a shields.io-style SVG. Left "would this win", right the odds and tier.

import type { Tier } from "./odds";

export const BADGE_COLOR: Record<Tier, string> = {
  winner: "#4D7CFF",
  top3: "#7FA0FF",
  honorable: "#F5A524",
  participating: "#FF3B30",
};

export const BADGE_TIER: Record<Tier, string> = {
  winner: "winner",
  top3: "top 3",
  honorable: "honorable mention",
  participating: "participating",
};

// Approximate Verdana 11px advance widths, as shields.io measures them.
const NARROW = /[ilj.,:;'!|() ]/;
const WIDE = /[mwMW%@]/;
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += NARROW.test(ch) ? 3.6 : WIDE.test(ch) ? 10 : /[A-Z0-9]/.test(ch) ? 7.2 : 6.4;
  return Math.ceil(w);
}

const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function badgeSvg(odds: number, tier: Tier): string {
  // Dark text on the light tier colors, white on red: both pass AA at this size.
  return draw(`${odds}% ${BADGE_TIER[tier]}`, BADGE_COLOR[tier], tier === "participating" ? "#fff" : "#0A0A0B");
}

/** For a repo with no shareable verdict yet: neutral grey, nothing claimed. */
export function notJudgedBadgeSvg(): string {
  return draw(NOT_JUDGED, "#3A3A3E", "#F4F4F2");
}

export const NOT_JUDGED = "not judged yet";

function draw(right: string, color: string, rightText: string): string {
  const left = "would this win";
  const lw = textWidth(left) + 12;
  const rw = textWidth(right) + 12;
  const w = lw + rw;
  const label = escXml(`${left}: ${right}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}"><title>${label}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#1C1C1F"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/><rect width="${w}" height="20" fill="url(#s)"/></g><g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14" fill="#F4F4F2">${escXml(left)}</text><text x="${lw + rw / 2}" y="14" fill="${rightText}">${escXml(right)}</text></g></svg>`;
}
