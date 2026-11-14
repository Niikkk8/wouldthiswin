"use client";

import { CircleX, GitPullRequest } from "lucide-react";
import { motion } from "motion/react";
import { createContext, useContext } from "react";
import { cn } from "cn";
import { copy } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export const ICON = 1.75;

export const projectName = (repo: string) => repo.split("/").pop() ?? repo;

/** A review shown as a still: no entrance, so its text is visible in the server HTML. */
export const Still = createContext(false);

/** Fades and rises once; under reduced motion, a plain 200ms crossfade. */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const still = useContext(Still);
  if (still) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

export function StatusPill({ ready, className }: { ready: boolean; className?: string }) {
  const Icon = ready ? GitPullRequest : CircleX;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[13px] font-medium",
        ready ? "bg-gain text-bg" : "bg-loss text-bg",
        className,
      )}
    >
      <Icon aria-hidden size={15} strokeWidth={ICON} />
      {ready ? copy.review.ready : copy.review.changes}
    </span>
  );
}

export function Lines({ start, excerpt }: { start: number; excerpt: string }) {
  const lines = excerpt.split("\n");
  return (
    <pre className="overflow-x-auto bg-bg py-3 font-mono text-[13px] leading-[1.6]">
      <code className="grid min-w-fit">
        {lines.map((l, i) => (
          <span key={i} className="grid grid-cols-[48px_1fr]">
            <span aria-hidden className="pr-4 text-right text-text-subtle select-none">
              {start + i}
            </span>
            <span className="pr-4 whitespace-pre text-text-muted">{l || " "}</span>
          </span>
        ))}
      </code>
    </pre>
  );
}
