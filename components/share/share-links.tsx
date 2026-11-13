"use client";

import { ExternalLink, Share2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "cn";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { Review } from "@/lib/review";
import { linkedInUrl, postToXUrl, reviewUrl, shareText, whatsAppUrl } from "@/lib/site";

const S = copy.acts.share;
const noop = () => () => {};

type Shared = Pick<Review, "id" | "repo" | "odds" | "readyToWin">;

/**
 * Every way to post a shareable verdict: X, LinkedIn, WhatsApp, the link itself, and the
 * phone's own share sheet where there is one. `onShare` hears which one was used.
 */
export function ShareLinks({ review, onShare, className }: { review: Shared; onShare?: (kind: "x" | "linkedin" | "whatsapp" | "link" | "native") => void; className?: string }) {
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const link = reviewUrl(review.id);
  const out = cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-2 px-4 text-[15px]");
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {canShare && (
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm" }), "gap-2 px-4 text-[15px]")}
          onClick={async () => {
            onShare?.("native");
            try {
              await navigator.share({ title: copy.meta.name, text: shareText(review), url: link });
            } catch {
              // Closing the sheet is fine; there's nothing to undo.
            }
          }}
        >
          <Share2 aria-hidden size={16} strokeWidth={1.75} />
          {S.shareSheet}
        </button>
      )}
      <a href={postToXUrl(review)} target="_blank" rel="noopener noreferrer" className={out} onClick={() => onShare?.("x")}>
        {S.postX}
        <ExternalLink aria-hidden size={15} strokeWidth={1.75} />
      </a>
      <a href={linkedInUrl(review.id)} target="_blank" rel="noopener noreferrer" className={out} onClick={() => onShare?.("linkedin")}>
        {S.postLinkedIn}
        <ExternalLink aria-hidden size={15} strokeWidth={1.75} />
      </a>
      <a href={whatsAppUrl(review)} target="_blank" rel="noopener noreferrer" className={out} onClick={() => onShare?.("whatsapp")}>
        {S.postWhatsApp}
        <ExternalLink aria-hidden size={15} strokeWidth={1.75} />
      </a>
      <CopyButton value={link} label={S.link} idle={S.copyLink} className="h-12 px-4 text-[15px]" onCopied={() => onShare?.("link")} />
    </div>
  );
}
