"use client";

// Magic UI animated-list, adapted for a chat: items arrive oldest first and stack downward,
// each one preceded by a typing indicator; it plays once and reports when it's done. With
// `instant` (reduced motion, or a revisit) everything shows at once with a crossfade.

import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export function AnimatedListItem({
  children,
  instant,
}: {
  children: React.ReactNode;
  instant?: boolean;
}) {
  return (
    <motion.li
      layout={!instant}
      initial={instant ? { opacity: 0 } : { scale: 0.92, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0, originY: 1, originX: 0 }}
      transition={instant ? { duration: 0.2 } : { type: "spring", stiffness: 350, damping: 40 }}
    >
      {children}
    </motion.li>
  );
}

export interface AnimatedListProps {
  children: React.ReactNode;
  /** Time from one item to the next, typing included. */
  delay?: number;
  /** How long the typing indicator shows before each item. */
  typingMs?: number;
  /** Shown while the next item is "typed"; gets that item's index. */
  typing?: (index: number) => React.ReactNode;
  onDone?: () => void;
  instant?: boolean;
  className?: string;
}

export function AnimatedList({
  children,
  delay = 900,
  typingMs = 450,
  typing,
  onDone,
  instant = false,
  className,
}: AnimatedListProps) {
  const items = useMemo(() => React.Children.toArray(children), [children]);
  const [shown, setShown] = useState(instant ? items.length : 0);
  const [isTyping, setTyping] = useState(false);
  const count = instant ? items.length : shown;

  useEffect(() => {
    if (instant || shown >= items.length) return;
    const t1 = setTimeout(() => setTyping(true), shown === 0 ? 0 : delay - typingMs);
    const t2 = setTimeout(
      () => {
        setTyping(false);
        setShown((n) => n + 1);
      },
      shown === 0 ? typingMs : delay,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [instant, shown, items.length, delay, typingMs]);

  useEffect(() => {
    if (count >= items.length && items.length > 0) onDone?.();
  }, [count, items.length, onDone]);

  return (
    <ol className={cn("flex flex-col gap-4", className)}>
      <AnimatePresence initial={!instant}>
        {items.slice(0, count).map((item, i) => (
          <AnimatedListItem key={(item as React.ReactElement).key ?? i} instant={instant}>
            {item}
          </AnimatedListItem>
        ))}
        {isTyping && typing && count < items.length && (
          <motion.li
            key="typing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15 }}
          >
            {typing(count)}
          </motion.li>
        )}
      </AnimatePresence>
    </ol>
  );
}
