"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

const TICKS = [
  "M 3 13 C 6 15, 8 18, 10 21 C 13 13, 18 7, 25 3",
  "M 2 12 C 5 14, 8 17, 9 20 C 13 12, 19 6, 26 4",
  "M 4 14 C 6 16, 8 19, 10 22 C 12 14, 17 8, 24 2",
];

type Item = { title: string; body: string };

/** A judge's checklist on the board; the ticks are drawn in once the list scrolls into view. */
export function CheckList({ items }: { items: readonly Item[] }) {
  const reduce = useReducedMotion();
  const list = useRef<HTMLDListElement>(null);
  const seen = useInView(list, { once: true, amount: 0.6 });
  const drawn = reduce || seen;
  return (
    <dl ref={list} className="space-y-7">
      {items.map((item, i) => (
        <div key={item.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline">
          <svg
            viewBox="0 0 28 24"
            className="h-5 w-6 translate-y-0.5 self-start overflow-visible"
            aria-hidden="true"
          >
            <motion.path
              d={TICKS[i % TICKS.length]}
              fill="none"
              stroke="#000"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              animate={drawn ? { pathLength: 1, opacity: 1 } : undefined}
              transition={{
                duration: 0.32,
                delay: 0.1 + i * 0.14,
                ease: [0.6, 0, 0.3, 1],
                opacity: { duration: 0.01, delay: 0.1 + i * 0.14 },
              }}
            />
          </svg>
          <div>
            <dt className="font-hand text-2xl font-bold leading-tight">{item.title}</dt>
            <dd className="mt-1 text-lg text-graphite text-pretty">{item.body}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
