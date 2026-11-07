"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { PAGE_FONTS, SHARE_FORMATS, ShareCard, type ShareFormat } from "@/components/share-card";
import type { Review } from "@/lib/review";

/**
 * A share image drawn in the page at whatever width it's given: laid out at full size and
 * zoomed to fit, so it matches the image the OG route makes, with no request.
 */
export function ShareCardPreview({
  review,
  format = "og",
  className,
  label,
}: {
  review: Review;
  format?: ShareFormat;
  className?: string;
  label: string;
}) {
  const { width, height } = SHARE_FORMATS[format];
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setZoom(e.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      style={{ aspectRatio: `${width} / ${height}` }}
      className={cn("w-full overflow-hidden rounded-card border border-border bg-bg", className)}
    >
      {zoom > 0 && (
        <div aria-hidden style={{ width, height, zoom }}>
          <ShareCard r={review} format={format} fonts={PAGE_FONTS} />
        </div>
      )}
    </div>
  );
}
