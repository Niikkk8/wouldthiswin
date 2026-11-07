import { ImageResponse } from "next/og";
import { LOGO_RATIO, logoDataUri } from "@/lib/logo";

// The favicon, generated from public/logo.png on the page background.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const src = await logoDataUri();
  const w = 28;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0B", borderRadius: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={w} height={Math.round(w * LOGO_RATIO)} />
      </div>
    ),
    size,
  );
}
