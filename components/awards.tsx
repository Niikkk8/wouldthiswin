import { copy } from "@/lib/copy";

/** Pleated edge of a rosette: a polygon alternating between two radii. */
function pleats(cx: number, cy: number, outer: number, inner: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

type RosetteProps = {
  size: number;
  face: string;
  edge: string;
  tails?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Ribbon rosette. With tails it's the winner's ribbon; without, the runner-up kind. */
export function Rosette({ size, face, edge, tails = false, className, style }: RosetteProps) {
  const w = 100;
  const h = tails ? 170 : 100;
  return (
    <svg
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={style}
      aria-hidden="true"
    >
      {tails && (
        <g fill={edge}>
          <polygon points="36,60 52,64 40,166 30,152 22,160" />
          <polygon points="64,60 48,64 60,166 70,152 78,160" />
        </g>
      )}
      <polygon points={pleats(50, 50, 48, 41, 26)} fill={edge} />
      <circle cx="50" cy="50" r="33" fill={face} />
      <circle
        cx="50"
        cy="50"
        r="26"
        fill="none"
        stroke={edge}
        strokeWidth="2"
        strokeDasharray="3 3"
      />
      <circle cx="50" cy="50" r="17" fill={edge} opacity="0.25" />
    </svg>
  );
}

/** A five-point star for the clip-art border. */
function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function starBorder(w: number, h: number, inset: number, gap: number, r: number) {
  const stars: string[] = [];
  for (let x = inset; x <= w - inset + 0.1; x += gap) {
    stars.push(star(x, inset, r), star(x, h - inset, r));
  }
  for (let y = inset + gap; y < h - inset - gap / 2; y += gap) {
    stars.push(star(inset, y, r), star(w - inset, y, r));
  }
  return stars;
}

/**
 * Printed on the office inkjet: clip-art star border, a script title from the
 * default font menu, cyan/magenta misregistration, and everything a little
 * off-centre because nobody checked the print preview.
 */
export function Certificate({ repo, width = 300 }: { repo: string; width?: number }) {
  const w = 300;
  const h = 212;
  const s = width / w;
  return (
    <div
      className="grain relative bg-white shadow-[0_1px_1px_rgb(0_0_0/0.12),0_3px_6px_-2px_rgb(0_0_0/0.18)]"
      style={{ width, height: h * s }}
    >
      <svg
        className="absolute inset-0"
        width={width}
        height={h * s}
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden="true"
      >
        {starBorder(w, h, 13, 15.5, 5.5).map((p, i) => (
          <polygon key={i} points={p} fill="#3d58c9" opacity="0.85" />
        ))}
        <rect
          x="24"
          y="24"
          width={w - 48}
          height={h - 48}
          fill="none"
          stroke="#3d58c9"
          strokeWidth="0.8"
          opacity="0.7"
        />
      </svg>
      <div
        className="absolute flex flex-col items-center text-center"
        style={{ left: 30 * s, right: 22 * s, bottom: 30 * s }}
      >
        <p
          className="font-script leading-none text-[#1f3aa8]"
          style={{
            fontSize: 27 * s,
            textShadow: "0.7px 0.4px 0 rgba(0,170,230,0.55), -0.6px -0.2px 0 rgba(230,0,120,0.35)",
          }}
        >
          {copy.certificate.title}
        </p>
        <p className="mt-2 text-[#5a5f66]" style={{ fontSize: 10 * s }}>
          {copy.certificate.awardedTo}
        </p>
        <p className="font-semibold text-[#222]" style={{ fontSize: 13 * s }}>
          {repo}
        </p>
      </div>
    </div>
  );
}
