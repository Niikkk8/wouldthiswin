"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { ReviewView } from "@/components/review/review-view";
import dynamic from "next/dynamic";
import { buttonVariants } from "@/components/ui/button";
import { badgeSvg } from "@/lib/badge";
import { copy } from "@/lib/copy";
import { demoState } from "@/lib/demo/fixture";
import { reviewOf } from "@/lib/review";
import { badgeMarkdown } from "@/lib/site";

// The card is drawn in the browser (it carries the judges' faces): loaded after the text,
// in a box the same shape so nothing moves when it arrives.
const CardBox = () => <div className="mt-3 aspect-[1200/630] w-full rounded-card border border-border bg-bg" />;
const ShareCardPreview = dynamic(() => import("@/components/share-card-preview").then((m) => m.ShareCardPreview), {
  ssr: false,
  loading: CardBox,
});

/** True once the element is within a screen or so of the viewport. */
function useNear<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

function CopyMarkdown({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "secondary" }), "h-10 shrink-0 gap-2 px-3 text-[14px]")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
      aria-label={`${copy.acts.share.copy}: ${copy.landing.walkAway.badge}`}
    >
      {copied ? <Check aria-hidden size={16} strokeWidth={1.75} /> : <Copy aria-hidden size={16} strokeWidth={1.75} />}
      <span aria-live="polite">{copied ? copy.acts.share.copied : copy.acts.share.copy}</span>
    </button>
  );
}

/** The review, the badge and the share card, all from the sample session. */
export function WalkAway() {
  // A fixed clock: the finished sample never looks at the time, and the page renders on the server.
  const [review] = useState(() => reviewOf(demoState("verdict", 0))!);
  const w = copy.landing.walkAway;
  const md = badgeMarkdown(review.id);
  const [cardRef, cardNear] = useNear<HTMLElement>();
  const badge = `data:image/svg+xml;utf8,${encodeURIComponent(badgeSvg(review.odds, review.tier))}`;
  return (
    <section aria-labelledby="walk-heading" className="page-x py-20 lg:py-28">
      <h2 id="walk-heading" className="text-[36px] leading-none font-black tracking-[-0.04em] lg:text-act">
        {w.heading}
      </h2>
      <p className="mt-4 text-[18px] leading-snug text-text-muted lg:text-[20px]">{w.lede}</p>

      <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-14">
        <section aria-labelledby="walk-review" className="min-w-0">
          <h3 id="walk-review" className="label-mono uppercase">
            {w.review}
          </h3>
          <div className="relative mt-3 max-h-[880px] overflow-hidden rounded-panel border border-border px-5 pb-8 sm:px-8">
            <ReviewView review={review} still />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-12">
          <section aria-labelledby="walk-card" ref={cardRef}>
            <h3 id="walk-card" className="label-mono uppercase">
              {w.card}
            </h3>
            {cardNear ? (
              <ShareCardPreview
                review={review}
                className="mt-3"
                label={`${review.repo}: ${review.odds}%, ${copy.tiers[review.tier]} "${review.oneLiner}"`}
              />
            ) : (
              <CardBox />
            )}
            <p className="label-mono mt-2">{w.cardNote}</p>
          </section>
          <section aria-labelledby="walk-badge">
            <h3 id="walk-badge" className="label-mono uppercase">
              {w.badge}
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badge} alt={`would this win: ${review.odds}% ${copy.tiers[review.tier]}`} height={20} className="mt-3 h-5 w-auto" />
            <div className="mt-3 flex items-stretch gap-2">
              <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-control border border-border bg-surface px-3 py-2 font-mono text-[13px] whitespace-nowrap text-text-muted">
                {md}
              </code>
              <CopyMarkdown text={md} />
            </div>
            <p className="label-mono mt-2">{w.badgeNote}</p>
          </section>
        </div>
      </div>
    </section>
  );
}
