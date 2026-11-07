import { encode } from "uqr";

/** A QR code, dark on light so every phone camera reads it. */
export function QrCode({ text, label, size = 132 }: { text: string; label: string; size?: number }) {
  const { data, size: n } = encode(text, { ecc: "M", border: 0 });
  // The standard four-module quiet zone, light like the code's background.
  const quiet = 4;
  const total = n + quiet * 2;
  let d = "";
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + quiet},${y + quiet}h1v1h-1z`;
    }),
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className="shrink-0 rounded-[6px]"
      role="img"
      aria-label={label}
      data-qr={text}
    >
      <rect width={total} height={total} className="fill-text" />
      <path d={d} className="fill-bg" />
    </svg>
  );
}
