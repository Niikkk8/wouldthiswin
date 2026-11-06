import { Fragment } from "react";

const TOTAL = 1.2; // seconds, first letter starts to last letter finishes
const START = 0.15;
const WORD_GAP = 0.6; // a pen lift between words, in letter-slots

/** Deterministic jitter in [-1, 1], so every render produces the same timing. */
const jitter = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

type Letter = { ch: string; delay: number; duration: number };

/** Per-letter timing: slightly uneven, like handwriting, scaled to end at TOTAL. */
function schedule(text: string): Letter[][] {
  let t = 0;
  let i = 0;
  const raw = text.split(" ").map((word) => {
    const letters = Array.from(word).map((ch) => {
      const letter = { ch, start: t, len: 1.5 + jitter(i) * 0.35 };
      t += 1 + jitter(i + 31) * 0.25;
      i++;
      return letter;
    });
    t += WORD_GAP;
    return letters;
  });
  const last = raw.flat().at(-1)!;
  const scale = TOTAL / (last.start + last.len);
  return raw.map((w) =>
    w.map(({ ch, start, len }) => ({ ch, delay: START + start * scale, duration: len * scale })),
  );
}

/**
 * "Would this win?" written on in marker. Each letter is revealed by a soft
 * mask moving in the writing direction. Pure CSS, so it starts at first paint
 * rather than after hydration; reduced motion shows the text immediately.
 */
export function MarkerHeadline({ text, className }: { text: string; className?: string }) {
  const words = schedule(text);
  let n = 0;
  return (
    <h1 className={className} aria-label={text}>
      {words.map((word, wi) => (
        <Fragment key={wi}>
          {wi > 0 && " "}
          <span className="inline-block whitespace-nowrap" aria-hidden="true">
            {word.map((l) => (
              <span
                key={n++}
                className="ink-letter"
                style={{ animationDelay: `${l.delay}s`, animationDuration: `${l.duration}s` }}
              >
                {l.ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </h1>
  );
}
