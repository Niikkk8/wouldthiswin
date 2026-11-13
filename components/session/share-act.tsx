"use client";

import { Download } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { REPO_FOCUS } from "@/components/landing/repo-form";
import { SampleTag } from "@/components/landing/sample-tag";
import { POST_FORMATS, SHARE_FORMATS, type PostFormat } from "@/components/share-card";
import { QrCode } from "@/components/qr-code";
import { ShareCardPreview } from "@/components/share-card-preview";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import type { Review } from "@/lib/review";
import type { SessionView } from "@/lib/session";
import { logShare } from "@/lib/share-events";
import {
  SITE_URL,
  badgeMarkdown,
  badgePath,
  captionFor,
  imageFileName,
  imagePath,
  postToXUrl,
  reviewUrl,
  shareText,
} from "@/lib/site";
import { useDesktop } from "@/lib/use-desktop";
import { ShareLinks } from "@/components/share/share-links";
import { VisibilityPanel } from "@/components/share/visibility-panel";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ReReview } from "@/components/review/re-review";
import { ActTitle } from "./act-parts";
import { ActionBar } from "./action-bar";

const S = copy.acts.share;

function Field({ label, note, value, children }: { label: string; note: string; value: string; children?: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="label-mono uppercase">{label}</h2>
      {children}
      <div className="mt-3 flex items-stretch gap-2">
        <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-control border border-border bg-surface px-3 py-2 font-mono text-[13px] whitespace-nowrap text-text-muted">
          {value}
        </code>
        <CopyButton value={value} label={label} />
      </div>
      <p className="label-mono mt-2">{note}</p>
    </section>
  );
}

/** The largest box of the image's shape that fits the column and a share of the screen's height. */
function useFit(format: PostFormat) {
  const { width, height } = SHARE_FORMATS[format];
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const maxH = Math.min(window.innerHeight * (window.innerWidth >= 1024 ? 0.46 : 0.5), 560);
      setW(Math.floor(Math.min(el.clientWidth, (maxH * width) / height)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [width, height]);
  return { ref, w, h: Math.round((w * height) / width) };
}

/** The image people will post: the real PNG, or for the sample, the same card drawn in the page. */
function Preview({ review, format, sample }: { review: Review; format: PostFormat; sample: boolean }) {
  const { ref, w, h } = useFit(format);
  const alt = fill(S.imageAlt, { repo: review.repo, odds: review.odds, tier: copy.tiers[review.tier], oneLiner: review.oneLiner });
  return (
    <div ref={ref} className="mt-4 w-full">
      {w > 0 &&
        (sample ? (
          <div style={{ width: w }}>
            <ShareCardPreview key={format} review={review} format={format} label={alt} />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={format}
            src={imagePath(review.id, format)}
            alt={alt}
            width={w}
            height={h}
            style={{ width: w, height: h }}
            className="rounded-card border border-border bg-surface"
          />
        ))}
    </div>
  );
}

function FormatPicker({ format, onChange }: { format: PostFormat; onChange: (f: PostFormat) => void }) {
  return (
    <div role="group" aria-label={S.formatsLabel} className="inline-flex rounded-control border border-border-strong p-1">
      {POST_FORMATS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={f === format}
          onClick={() => onChange(f)}
          className="rounded-[6px] px-3.5 py-1.5 text-[15px] font-bold text-text-muted transition-colors hover:text-text aria-pressed:bg-surface-2 aria-pressed:text-text"
        >
          {S.formats[f]}
        </button>
      ))}
    </div>
  );
}

const noSubscribe = () => () => {};

/** Prefetched image files, so the share sheet opens inside the tap that asked for it. */
function useImageFiles(review: Review, enabled: boolean, format: PostFormat) {
  const files = useRef(new Map<PostFormat, Promise<File | null>>());
  const get = (f: PostFormat) => {
    let p = files.current.get(f);
    if (!p) {
      p = fetch(imagePath(review.id, f))
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => (b ? new File([b], imageFileName(review, f), { type: "image/png" }) : null))
        .catch(() => null);
      files.current.set(f, p);
    }
    return p;
  };
  useEffect(() => {
    if (enabled) void get(format);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, format]);
  return get;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * The share screen: the images in each format, and every way to post them. In the sample
 * session the images are drawn from the fixture and nothing links to a review that doesn't
 * exist. `phone` is the page the QR code opens: the same screen for whoever holds the link.
 */
export function ShareScreen({ review: r, demo = false, phone = false }: { review: Review; demo?: boolean; phone?: boolean }) {
  const reduce = useReducedMotion();
  const desktop = useDesktop();
  const [format, setFormat] = useState<PostFormat>("landscape");
  const [visibility, setVisibility] = useState({ shareable: r.shareable, listed: r.listed });
  // Nothing that points at the verdict link appears until the owner turns the link on.
  const shared = visibility.shareable;
  const getFile = useImageFiles(r, !demo && !desktop, format);
  const caption = shared ? captionFor(r) : shareText(r);
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => SITE_URL);

  const shareImage = async () => {
    logShare(r.id, { kind: "share_image", format });
    const file = await getFile(format);
    if (!file) {
      window.open(imagePath(r.id, format), "_blank", "noopener");
      return;
    }
    const data: ShareData = { files: [file], text: caption, title: copy.meta.name };
    if (navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
      } catch (err) {
        // Closing the share sheet is fine. Anything else (the browser said it could share
        // files, then refused): fall back to saving the image.
        if ((err as Error)?.name !== "AbortError") downloadFile(file);
      }
    } else downloadFile(file);
  };

  return (
    <>
      <ActTitle eyebrow={S.eyebrow} title={phone ? S.phoneTitle : S.title} />
      <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
        <motion.section
          className="min-w-0"
          aria-label={S.card}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE }}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <FormatPicker format={format} onChange={setFormat} />
            {demo ? <SampleTag>{copy.demo.sampleImages}</SampleTag> : <p className="label-mono">{S.formatNotes[format]}</p>}
          </div>
          <Preview review={r} format={format} sample={demo} />
        </motion.section>

        <motion.div
          className="grid min-w-0 content-start gap-9"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE, delay: reduce ? 0 : 0.15 }}
        >
          {demo ? (
            <p className="text-[20px] leading-snug font-bold">{copy.demo.shareNote}</p>
          ) : (
            <>
              {!phone && <VisibilityPanel id={r.id} value={visibility} onChange={setVisibility} />}
              {shared ? (
                <ShareLinks
                  review={r}
                  onShare={(kind) => {
                    if (kind === "x") logShare(r.id, { kind: "x_clicked" });
                    if (kind === "linkedin") logShare(r.id, { kind: "linkedin_clicked" });
                  }}
                />
              ) : (
                <p className="text-[15px] leading-snug text-text-muted">{S.visibility.off}</p>
              )}
              {/* Desktop downloads; on a phone the share sheet covers it. */}
              <section className="grid gap-3 max-lg:hidden">
                <h2 className="label-mono uppercase">{S.downloads}</h2>
                <div className="grid grid-cols-3 gap-2">
                  {POST_FORMATS.map((f) => (
                    <a
                      key={f}
                      href={imagePath(r.id, f)}
                      download={imageFileName(r, f)}
                      onClick={() => logShare(r.id, { kind: "download", format: f })}
                      aria-label={fill(S.downloadFormat, { format: S.formats[f] })}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5 px-3 text-[14px]")}
                    >
                      <Download aria-hidden size={16} strokeWidth={1.75} />
                      {S.formats[f]}
                    </a>
                  ))}
                </div>
              </section>

              <section className="min-w-0">
                <h2 className="label-mono uppercase">{S.captionLabel}</h2>
                <p className="mt-3 rounded-control border border-border bg-surface px-3.5 py-3 text-[15px] leading-snug text-text-muted">
                  {caption}
                </p>
                <div className="mt-2">
                  <CopyButton value={caption} label={S.captionLabel} onCopied={() => logShare(r.id, { kind: "caption_copied" })} />
                </div>
              </section>

              {!phone && shared && (
                <section className="flex items-center gap-5 max-lg:hidden">
                  <QrCode text={`${origin}/s/${r.id}/share`} label={S.qrNote} />
                  <div>
                    <h2 className="label-mono uppercase">{S.qr}</h2>
                    <p className="mt-2 text-[15px] leading-snug text-text-muted">{S.qrNote}</p>
                  </div>
                </section>
              )}

              {shared && (
                <>
                  <Field label={S.link} note={S.linkNote} value={reviewUrl(r.id)} />
                  <Field label={S.badge} note={S.badgeNote} value={badgeMarkdown(r.id)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={badgePath(r.id)} alt={`would this win: ${r.odds}% ${copy.tiers[r.tier]}`} height={20} className="mt-3 h-5 w-auto" />
                  </Field>
                </>
              )}
            </>
          )}
        </motion.div>
      </div>

      {demo ? (
        <ActionBar label={copy.demo.yourTurn} ready href={`/#${REPO_FOCUS}`} />
      ) : desktop ? (
        <ActionBar
          label={S.postX}
          ready={shared}
          status={S.visibility.off}
          onNext={() => {
            logShare(r.id, { kind: "x_clicked" });
            window.open(postToXUrl(r), "_blank", "noopener,noreferrer");
          }}
        />
      ) : (
        <ActionBar label={S.shareImage} ready onNext={() => void shareImage()} />
      )}
    </>
  );
}

/** After act 4. */
export function ShareAct({ view, demo = false }: { view: SessionView; demo?: boolean }) {
  if (!view.review) return null;
  return (
    <>
      <ShareScreen review={view.review} demo={demo} />
      {!demo && <ReReview id={view.review.id} repo={view.review.repo} className="mt-12" />}
    </>
  );
}
