"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Hand-placed, not gridded: each note has its own tilt, nudge and stacking,
 * and a few are held up with tape. From md up they scatter and overlap; on
 * mobile they stack in one column, alternating a little left and right.
 */
const LAYOUT = [
  { color: "#ffe15a", tilt: -2.4, x: 10, y: 4, z: 2, tape: -4, react: -3 },
  { color: "#ffadd2", tilt: 1.8, x: -4, y: 34, z: 3, tape: null, react: 2.5 },
  { color: "#a8d8ff", tilt: -1.3, x: -14, y: -8, z: 1, tape: 3, react: -2 },
  { color: "#a8d8ff", tilt: 2.6, x: 22, y: -18, z: 2, tape: null, react: 3 },
  { color: "#ffe15a", tilt: -1.6, x: 0, y: 26, z: 4, tape: -2, react: -2.5 },
  { color: "#ffadd2", tilt: 2.2, x: -10, y: -22, z: 5, tape: null, react: 2 },
];

// Stuck flat to the board: a tight contact shadow. Lifted: a softer, longer one.
const STUCK = "0 1px 1px rgb(0 0 0 / 0.14), 0 2px 3px -1px rgb(0 0 0 / 0.12)";
const LIFTED = "0 2px 3px rgb(0 0 0 / 0.1), 0 18px 26px -12px rgb(0 0 0 / 0.38)";

const MASK = "linear-gradient(90deg, #000 0 42%, transparent 58%)";

/** The judge's reaction in red marker, written in left to right when the note scrolls into view. */
function Reaction({ text, tilt }: { text: string; tilt: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.p
      className="-mx-2 mt-3 self-start px-2 py-1 font-hand text-lg font-bold leading-tight text-marker-red sm:text-xl"
      style={{
        rotate: tilt,
        maskImage: MASK,
        WebkitMaskImage: MASK,
        maskSize: "260% 100%",
        WebkitMaskSize: "260% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "var(--mask-x) 0%",
        WebkitMaskPosition: "var(--mask-x) 0%",
      }}
      initial={{ "--mask-x": reduce ? "0%" : "100%" }}
      whileInView={{ "--mask-x": "0%" }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.75, delay: 0.25, ease: [0.45, 0.05, 0.4, 1] }}
    >
      {text}
    </motion.p>
  );
}

export function JudgingNotes() {
  const reduce = useReducedMotion();
  const board = useRef<HTMLUListElement>(null);
  // Peeling notes off is a mouse thing; on touch it would fight scrolling.
  const canDrag = useMediaQuery("(pointer: fine)");
  // The note you last touched comes to the top of the pile.
  const [top, setTop] = useState<number | null>(null);

  return (
    <ul
      ref={board}
      className="mx-auto flex max-w-[940px] flex-col items-center md:flex-row md:flex-wrap md:justify-center"
    >
      {copy.judging.notes.map((note, i) => {
        const n = LAYOUT[i % LAYOUT.length];
        return (
          <li
            key={note.line}
            className="relative -mt-3 [translate:var(--mx)_0] first:mt-0 md:mx-1 md:-my-1.5 md:mt-0 md:[translate:var(--dx)_var(--dy)] md:first:-mt-4"
            style={{
              zIndex: top === i ? 20 : n.z,
              ["--dx" as string]: `${n.x}px`,
              ["--dy" as string]: `${n.y}px`,
              ["--mx" as string]: `${i % 2 ? 22 : -22}px`,
            }}
          >
            <motion.div
              className={`note-curl grain relative flex aspect-square w-[min(290px,80vw)] flex-col justify-center px-6 py-6 md:w-[300px] md:px-7 md:py-7 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{ backgroundColor: n.color, ["--note" as string]: n.color }}
              initial={{ rotate: n.tilt, y: 0, boxShadow: STUCK }}
              whileHover={reduce ? undefined : { rotate: n.tilt * 0.4, y: -8, boxShadow: LIFTED }}
              whileDrag={{ rotate: n.tilt * 0.2 + 1, scale: 1.04, boxShadow: LIFTED }}
              drag={canDrag}
              dragConstraints={board}
              dragElastic={0.12}
              dragMomentum={false}
              onHoverStart={() => setTop(i)}
              onDragStart={() => setTop(i)}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              {n.tape !== null && (
                <span
                  className="tape -top-3 left-1/2 -translate-x-1/2"
                  style={{ rotate: `${n.tape}deg` }}
                  aria-hidden="true"
                />
              )}
              <p className="font-hand text-xl font-bold leading-[1.18] text-pretty md:text-[1.375rem]">
                {note.line}
              </p>
              <Reaction text={note.reaction} tilt={n.react} />
            </motion.div>
          </li>
        );
      })}
    </ul>
  );
}
