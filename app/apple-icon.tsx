import { ImageResponse } from "next/og";
import { LOGO_RATIO, logoDataUri } from "@/lib/logo";

// The home-screen icon, generated from public/logo.png. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const src = await logoDataUri();
  const w = 128;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0B" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={w} height={Math.round(w * LOGO_RATIO)} />
      </div>
    ),
    size,
  );
}
