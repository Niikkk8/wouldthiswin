"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { copy } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import type { SessionView } from "@/lib/session";
import { badgeMarkdown, badgePath, ogPath, postToXUrl, reviewPath, reviewUrl } from "@/lib/site";
import { ActTitle } from "./act-parts";
import { useReducedMotion } from "@/lib/use-reduced-motion";

function CopyButton({ text, label }: { text: string; label: string }) {
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
        } catch {
          setCopied(false);
        }
      }}
      aria-label={`${copy.acts.share.copy}: ${label}`}
    >
      {copied ? <Check aria-hidden size={16} strokeWidth={1.75} /> : <Copy aria-hidden size={16} strokeWidth={1.75} />}
      <span aria-live="polite">{copied ? copy.acts.share.copied : copy.acts.share.copy}</span>
    </button>
  );
}

function Field({ label, note, value, children }: { label: string; note: string; value: string; children?: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="label-mono uppercase">{label}</h2>
      {children}
      <div className="mt-3 flex items-stretch gap-2">
        <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-control border border-border bg-surface px-3 py-2 font-mono text-[13px] whitespace-nowrap text-text-muted">
          {value}
        </code>
        <CopyButton text={value} label={label} />
      </div>
      <p className="label-mono mt-2">{note}</p>
    </section>
  );
}

/** The share screen: the card, the X post, the public review link and the README badge. */
export function ShareAct({ view }: { view: SessionView }) {
  const reduce = useReducedMotion();
  const r = view.review;
  if (!r) return null;
  return (
    <>
      <ActTitle eyebrow={copy.acts.share.eyebrow} title={copy.acts.share.title} />
      <div className="mt-8 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
        <motion.section
          className="min-w-0"
          aria-labelledby="card"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE }}
        >
          <h2 id="card" className="label-mono uppercase">
            {copy.acts.share.card}
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ogPath(r.id)}
            alt={`${r.repo}: ${r.odds}%, ${copy.tiers[r.tier]} "${r.oneLiner}"`}
            width={1200}
            height={630}
            className="mt-3 aspect-[1200/630] w-full rounded-card border border-border bg-surface"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={postToXUrl(r)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants(), "gap-2")}>
              {copy.acts.share.postX}
              <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
            </a>
            <a href={reviewPath(r.id)} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}>
              {copy.acts.share.open}
            </a>
          </div>
        </motion.section>

        <motion.div
          className="grid min-w-0 content-start gap-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE, delay: reduce ? 0 : 0.15 }}
        >
          <Field label={copy.acts.share.link} note={copy.acts.share.linkNote} value={reviewUrl(r.id)} />
          <Field label={copy.acts.share.badge} note={copy.acts.share.badgeNote} value={badgeMarkdown(r.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgePath(r.id)} alt={`would this win: ${r.odds}% ${copy.tiers[r.tier]}`} height={20} className="mt-3 h-5 w-auto" />
          </Field>
        </motion.div>
      </div>
    </>
  );
}
