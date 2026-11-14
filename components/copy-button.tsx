"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { copy as text } from "@/lib/copy";

/** Copies `value` to the clipboard and says so for a moment. `label` names what's copied, for screen readers. */
export function CopyButton({
  value,
  label,
  idle = text.acts.share.copy,
  className,
  onCopied,
  getValue,
}: {
  value: string;
  /** Reads the text at click time instead, for content that's only in the DOM. */
  getValue?: () => string;
  label: string;
  idle?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ variant: "secondary" }),
        "h-10 shrink-0 gap-2 px-3 text-[14px]",
        className,
      )}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getValue ? getValue() : value);
          setCopied(true);
          onCopied?.();
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      aria-label={`${idle}: ${label}`}
    >
      {copied ? (
        <Check aria-hidden size={16} strokeWidth={1.75} />
      ) : (
        <Copy aria-hidden size={16} strokeWidth={1.75} />
      )}
      <span aria-live="polite">{copied ? text.acts.share.copied : idle}</span>
    </button>
  );
}
