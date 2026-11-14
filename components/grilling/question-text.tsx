"use client";

import { motion } from "motion/react";
import { cn } from "cn";
import { UNDERLINE_WORD_MS, WORD_IN_MS, WORD_MS } from "@/lib/deadline";
import { EASE } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// The server times the answer clock from the same constants (lib/deadline.ts typingMs), so the
// clock never starts before the last word has landed.

/**
 * The question, word by word at 60ms a word. The caught phrase comes in last, in red, and
 * its underline draws in after it. `onTyped` fires the moment the last word has landed.
 */
export function QuestionText({
  text,
  caught,
  onTyped,
}: {
  text: string;
  caught: string | null;
  onTyped: () => void;
}) {
  const reduce = useReducedMotion();
  const at = caught ? text.indexOf(caught) : -1;
  const parts =
    caught && at >= 0
      ? [
          { text: text.slice(0, at), caught: false },
          { text: caught, caught: true },
          { text: text.slice(at + caught.length), caught: false },
        ]
      : [{ text, caught: false }];

  if (reduce) {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onAnimationComplete={onTyped}
      >
        {parts.map((p, i) =>
          p.caught ? (
            <span key={i} className="text-loss underline decoration-2 underline-offset-[0.14em]">
              {p.text}
            </span>
          ) : (
            p.text
          ),
        )}
      </motion.span>
    );
  }

  // Plain words go in reading order; the caught words wait until all of them are in, then
  // their underline draws.
  type Token = {
    text: string;
    caught: boolean;
    delay: number;
    underline: number;
    bridge: boolean;
    last?: boolean;
  };
  const raw = parts.flatMap((p) => words(p.text).map((w) => ({ text: w, caught: p.caught })));
  const isWord = (t?: { text: string }) => !!t && !/^\s+$/.test(t.text);
  const plainCount = raw.filter((t) => isWord(t) && !t.caught).length;
  const caughtCount = raw.filter((t) => isWord(t) && t.caught).length;
  const caughtStart = (plainCount + 2) * WORD_MS;
  const lineStart = caughtStart + caughtCount * WORD_MS + 120;
  let plain = 0;
  let late = 0;
  const tokens: (Token | string)[] = raw.map((t, i) => {
    if (!isWord(t)) return t.text;
    const k = t.caught ? late++ : plain++;
    return {
      ...t,
      delay: t.caught ? caughtStart + k * WORD_MS : k * WORD_MS,
      underline: lineStart + k * UNDERLINE_WORD_MS,
      // Bridge the space to the next caught word so the underline reads as one line.
      bridge: t.caught && !isWord(raw[i + 1]) && !!raw[i + 2]?.caught,
    };
  });
  // The word that lands last ends the typing.
  const placed = tokens.filter((t): t is Token => typeof t !== "string");
  if (placed.length) placed.reduce((a, b) => (b.delay >= a.delay ? b : a)).last = true;
  // Tokens with no space between them ("calls" + ",") stay on one line together.
  const groups: (Token[] | string)[] = [];
  for (const t of tokens) {
    if (typeof t === "string") groups.push(t);
    else if (Array.isArray(groups.at(-1))) (groups.at(-1) as Token[]).push(t);
    else groups.push([t]);
  }

  return (
    <>
      {groups.map((g, gi) =>
        typeof g === "string" ? (
          g
        ) : (
          <span key={gi} className="whitespace-nowrap">
            {g.map((t, ti) => (
              <motion.span
                key={ti}
                // A token wider than the line (a long file name) may break inside itself.
                className={cn(
                  "relative inline-block max-w-full whitespace-normal [overflow-wrap:anywhere]",
                  t.caught && "text-loss",
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: WORD_IN_MS / 1000, ease: EASE, delay: t.delay / 1000 }}
                onAnimationComplete={t.last ? onTyped : undefined}
              >
                {t.text}
                {t.caught && (
                  <motion.span
                    aria-hidden
                    className={cn(
                      "absolute -bottom-[0.04em] left-0 h-[0.06em] min-h-[2px] origin-left bg-loss",
                      t.bridge ? "-right-[0.28em]" : "right-0",
                    )}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.18, ease: "linear", delay: t.underline / 1000 }}
                  />
                )}
              </motion.span>
            ))}
          </span>
        ),
      )}
    </>
  );
}

const words = (s: string) => s.split(/(\s+)/).filter(Boolean);
