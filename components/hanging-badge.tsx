import type { Verdict } from "@/lib/judge";
import { Rosette, Certificate } from "./awards";
import { Badge, BADGE_COLORS } from "./badge";

type Props = {
  repo: string;
  overall: number;
  verdict: Verdict;
  width?: number;
  lanyard?: number; // visible strap length in px
  hook?: boolean;
  animate?: boolean;
};

/**
 * "neck": two straps coming down from above the frame, as if worn.
 * "hook": a loop hung from a whiteboard magnet, for badges mid-page.
 */
export function Lanyard({
  width,
  height,
  mode = "neck",
}: {
  width: number;
  height: number;
  mode?: "neck" | "hook";
}) {
  const cx = width / 2;
  const strap = 15;
  const clipTop = height - 22;
  const spread = mode === "neck" ? Math.min(width * 0.32, 90) : 15;
  const strapPath =
    mode === "neck"
      ? `M ${cx - spread - strap / 2} -4 L ${cx - 9} ${clipTop} M ${cx + spread + strap / 2} -4 L ${cx + 9} ${clipTop}`
      : `M ${cx - 3} 14 L ${cx - spread} ${height * 0.5} L ${cx - 9} ${clipTop} M ${cx + 3} 14 L ${cx + spread} ${height * 0.5} L ${cx + 9} ${clipTop}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="block overflow-visible"
    >
      <path
        d={strapPath}
        stroke={BADGE_COLORS.lanyard}
        strokeWidth={strap}
        strokeLinejoin="round"
        fill="none"
      />
      {mode === "hook" && (
        <>
          <circle cx={cx} cy="12" r="13" fill="#2a2f35" />
          <circle cx={cx - 4} cy="8" r="3.5" fill="#ffffff" opacity="0.25" />
        </>
      )}
      {/* metal clip */}
      <rect x={cx - 13} y={clipTop - 4} width="26" height="12" rx="3" fill="#9aa4ab" />
      <rect x={cx - 3} y={clipTop + 6} width="6" height="18" rx="2" fill="#7d878e" />
    </svg>
  );
}

function Award({ verdict, width, animate }: { verdict: Verdict; width: number; animate: boolean }) {
  const cls = `${animate ? "attach " : ""}absolute z-20`;
  switch (verdict) {
    case "Winner.":
      return (
        <Rosette
          size={width * 0.34}
          face="#f6d35b"
          edge="#e8b10e"
          tails
          className={cls}
          style={{
            right: -width * 0.08,
            bottom: -width * 0.44,
            ["--tilt" as string]: "-8deg",
            transform: "rotate(var(--tilt))",
          }}
        />
      );
    case "Top 3, probably.":
      return (
        <Rosette
          size={width * 0.27}
          face="#6f8ff0"
          edge="#2d5be3"
          className={cls}
          style={{
            right: -width * 0.07,
            bottom: -width * 0.06,
            ["--tilt" as string]: "10deg",
            transform: "rotate(var(--tilt))",
          }}
        />
      );
    case "Honorable mention.":
      return (
        <Rosette
          size={width * 0.22}
          face="#eef1f2"
          edge="#8a959d"
          className={cls}
          style={{
            right: -width * 0.05,
            bottom: -width * 0.04,
            ["--tilt" as string]: "10deg",
            transform: "rotate(var(--tilt))",
          }}
        />
      );
    default:
      return null;
  }
}

export function HangingBadge({
  repo,
  overall,
  verdict,
  width = 260,
  lanyard = 140,
  hook = false,
  animate = false,
}: Props) {
  const [owner, name] = repo.includes("/") ? repo.split("/", 2) : [undefined, repo];
  const certificate = verdict === "Thank you for participating.";
  const certWidth = Math.round(width * 1.04);
  return (
    <div
      className="relative"
      style={{ width, paddingBottom: verdict === "Winner." ? width * 0.36 : 0 }}
    >
      <div
        className={`relative z-10 drop-shadow-[0_18px_18px_rgb(0_0_0/0.15)] ${animate ? "swing" : ""}`}
      >
        <Lanyard width={width} height={lanyard} mode={hook ? "hook" : "neck"} />
        <div className="relative z-10 -mt-1">
          <div className="grain relative" style={{ borderRadius: Math.round((14 * width) / 260) }}>
            <Badge
              title={name}
              subtitle={owner}
              overall={overall}
              verdict={verdict}
              width={width}
            />
          </div>
          <Award verdict={verdict} width={width} animate={animate} />
        </div>
      </div>
      {certificate && (
        <div
          className={`relative z-0 ${animate ? "attach" : ""}`}
          style={{
            width: certWidth,
            marginTop: -width * 0.2,
            marginLeft: width * 0.03,
            transform: "rotate(3deg)",
            ["--tilt" as string]: "3deg",
          }}
        >
          <Certificate repo={repo} width={certWidth} />
        </div>
      )}
    </div>
  );
}
