"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { PAGE_FONTS, ShareCard } from "@/components/share-card";
import type { Review } from "@/lib/review";

/**
 * The share card drawn in the page at whatever width it's given: laid out at 1200x630 and
 * zoomed to fit, so it matches the image the OG route makes, with no request.
 */
export function ShareCardPreview({ review, className, label }: { review: Review; className?: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setZoom(e.contentRect.width / 1200));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      className={cn("aspect-[1200/630] w-full overflow-hidden rounded-card border border-border bg-bg", className)}
    >
      {zoom > 0 && (
        <div aria-hidden style={{ width: 1200, height: 630, zoom }}>
          <ShareCard r={review} fonts={PAGE_FONTS} />
        </div>
      )}
    </div>
  );
}
