/**
 * Faint traces of marker that didn't quite erase. Decorative, sits behind content.
 * Each variant is a different leftover: a crossed-out idea, a box-and-arrow sketch.
 */
const STROKE = {
  stroke: "#4a5560",
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const GHOSTS = {
  idea: (
    <>
      <text
        x="8"
        y="58"
        fontSize="56"
        fontFamily="var(--font-hand)"
        fontWeight="700"
        fill="#4a5560"
      >
        MVP?
      </text>
      <path d="M 4 40 C 60 30, 120 46, 168 34" strokeWidth="5" {...STROKE} />
      <path
        d="M 180 40 C 220 70, 240 90, 300 96 M 300 96 l -18 -14 M 300 96 l -20 6"
        strokeWidth="5"
        {...STROKE}
      />
    </>
  ),
  sketch: (
    <>
      <rect x="10" y="20" width="110" height="64" rx="6" strokeWidth="5" {...STROKE} />
      <rect x="190" y="38" width="96" height="54" rx="6" strokeWidth="5" {...STROKE} />
      <path
        d="M 122 52 C 150 46, 166 58, 186 62 M 186 62 l -16 -10 M 186 62 l -18 4"
        strokeWidth="5"
        {...STROKE}
      />
      <text x="30" y="62" fontSize="26" fontFamily="var(--font-hand)" fill="#4a5560">
        API
      </text>
      <text x="206" y="74" fontSize="26" fontFamily="var(--font-hand)" fill="#4a5560">
        db??
      </text>
    </>
  ),
};

export function Ghost({
  variant,
  className,
}: {
  variant: keyof typeof GHOSTS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 310 120"
      className={`pointer-events-none absolute -z-10 select-none opacity-[0.055] blur-[1.2px] ${className ?? ""}`}
      aria-hidden="true"
    >
      {GHOSTS[variant]}
    </svg>
  );
}
