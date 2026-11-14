"use client";

import { CopyButton } from "@/components/copy-button";
import { copy } from "@/lib/copy";
import { repoBadgeMarkdown, repoBadgePath } from "@/lib/site";

const B = copy.acts.share;

/** The README badge for this repo, always its latest shareable verdict, with markdown to copy. */
export function BadgeSnippet({
  repo,
  id,
  className,
}: {
  repo: string;
  id: string;
  className?: string;
}) {
  const md = repoBadgeMarkdown(repo, id);
  return (
    <section aria-labelledby="badge" className={className}>
      <h2 id="badge" className="label-mono uppercase">
        {B.badge}
      </h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={repoBadgePath(repo)} alt={B.badgeAlt} height={20} className="mt-3 h-5 w-auto" />
      <div className="mt-3 flex items-stretch gap-2">
        <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-control border border-border bg-surface px-3 py-2 font-mono text-[13px] whitespace-nowrap text-text-muted">
          {md}
        </code>
        <CopyButton value={md} label={B.badge} />
      </div>
      <p className="label-mono mt-2">{B.badgeNote}</p>
    </section>
  );
}
