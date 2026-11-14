"use client";

import { useRef } from "react";
import { CopyButton } from "@/components/copy-button";
import { copy } from "@/lib/copy";

/** A code block in a guide, with a copy button for templates people paste into their own repo. */
export function CopyPre(props: React.ComponentProps<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <div className="relative mt-6">
      <pre
        ref={ref}
        className="overflow-x-auto rounded-card border border-border bg-surface p-5 pr-24 font-mono text-[15px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-text-muted"
        {...props}
      />
      <CopyButtonFor target={ref} />
    </div>
  );
}

function CopyButtonFor({ target }: { target: React.RefObject<HTMLPreElement | null> }) {
  // The text is read at click time, from the rendered block, so it's exactly what's shown.
  return (
    <span className="absolute top-3 right-3">
      <CopyButton
        value=""
        label={copy.guides.copyTemplate}
        idle={copy.guides.copyTemplate}
        getValue={() => target.current?.innerText ?? ""}
      />
    </span>
  );
}
