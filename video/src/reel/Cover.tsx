// The reel's cover: the face, sharp, with the hook on top and the odds card that sells it.
// Everything that matters sits inside the middle 1080x1350 (y 285 to 1635), the 4:5 area
// Instagram's profile grid shows, and clear of the Reels overlays when it plays.

import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, F, Grain } from "../v2/kit";

export type CoverProps = { face: string | null };

export function ReelCover({ face }: CoverProps) {
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      {face && <Img src={staticFile(face)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.1)", transformOrigin: "50% 42%" }} />}
      {/* Dark at the top for the headline, dark at the bottom for the card; the face stays lit. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,10,11,0.94) 0%, rgba(10,10,11,0.82) 26%, rgba(10,10,11,0.15) 44%, rgba(10,10,11,0) 52%, rgba(10,10,11,0.55) 66%, rgba(10,10,11,0.95) 86%)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 60% at 50% 70%, rgba(255,59,48,0.16) 0%, rgba(255,59,48,0) 70%)", mixBlendMode: "screen" }} />

      <div style={{ position: "absolute", left: 96, right: 96, top: 320 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: F.mono, fontSize: 30, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: C.loss, boxShadow: `0 0 20px ${C.loss}` }} />3 AI judges read your repo
        </div>
        <div style={{ marginTop: 26, fontFamily: F.display, fontWeight: 900, fontSize: 128, lineHeight: 0.98, letterSpacing: "-0.045em", color: C.text, textShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
          Would your
          <br />
          project{" "}
          <span style={{ color: C.loss, textDecoration: "underline", textDecorationThickness: "0.07em", textUnderlineOffset: "0.12em" }}>win?</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 130,
          width: 820,
          top: 1190,
          height: 380,
          borderRadius: 40,
          background: "linear-gradient(180deg, #17171a 0%, #0f0f11 100%)",
          border: `2px solid ${C.borderStrong}`,
          boxShadow: "0 50px 140px rgba(0,0,0,0.7), 0 0 80px rgba(255,59,48,0.18)",
          transform: "rotate(-3deg)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 38, right: 38, top: 28, display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12, color: C.text }}>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: C.loss }} />
            Your odds
          </span>
          <span style={{ color: C.subtle }}>PulseBoard</span>
        </div>
        <div style={{ position: "absolute", left: 38, right: 38, top: 86, bottom: 32, borderRadius: 24, overflow: "hidden", background: C.bg, border: `1px solid ${C.border}` }}>
          {/* The scan's real numbers for PulseBoard at the drop (the fixture through the odds engine). */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 40px", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
              <s style={{ fontFamily: F.mono, fontSize: 40, color: C.subtle }}>40%</s>
              <span style={{ fontFamily: F.display, fontWeight: 900, fontSize: 150, lineHeight: 0.9, letterSpacing: "-0.05em", color: C.loss, textShadow: "0 0 50px rgba(255,59,48,0.45)" }}>21%</span>
            </div>
            <div style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: 10, background: C.loss, color: C.bg, fontFamily: F.mono, fontSize: 28 }}>-19 Streaming claim unbacked</div>
          </div>
        </div>
      </div>
      <Grain frame={7} opacity={0.05} />
    </AbsoluteFill>
  );
}
