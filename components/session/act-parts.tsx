"use client";

import { motion } from "motion/react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { EASE } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** Eyebrow and title. The title rises 24px and fades in as the act arrives. */
export function ActTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      // Leaves room for the odds widget on the right.
      className="pt-6 lg:max-w-[calc(100%-360px)] lg:pt-4"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE }}
    >
      {eyebrow && <p className="label-mono uppercase">{eyebrow}</p>}
      <h1 className="mt-2 text-[36px] leading-none font-black tracking-[-0.04em] text-balance lg:text-act">
        {title}
      </h1>
    </motion.div>
  );
}

/** The one way forward out of an act. */
export function ActFooter({
  line,
  label,
  onClick,
  disabled,
  className,
}: {
  line?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      data-demo-hide
      className={cn(
        "mt-16 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-[20px] leading-snug font-bold text-balance">{line}</p>
      <Button onClick={onClick} disabled={disabled} className="w-full sm:w-auto">
        {label}
      </Button>
    </div>
  );
}
