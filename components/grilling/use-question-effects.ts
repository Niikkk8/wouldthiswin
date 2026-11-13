"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The Tired Judge nods off after this long without a keystroke. */
const DOZE_MS = 10_000;
/** The judge's reaction stays up this long before the next question. */
const REACTION_MS = 2000;
/** How long the chip sits by the reaction before it flies to the widget. */
const CHIP_HOLD_MS = 700;
/** The sample team starts typing this long after the question lands, this fast. */
const AUTO_START_MS = 700;
const AUTO_CHAR_MS = 22;

/** Ten seconds without a keystroke and the Tired Judge dozes off, until the next one. */
export function useDoze(asking: boolean, text: string) {
  const [dozing, setDozing] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setDozing(true), DOZE_MS);
    return () => clearTimeout(t);
  }, [asking, text]);
  return { dozing, wake: useCallback(() => setDozing(false), []) };
}

/**
 * The reaction: the chip sits by it, flies to the widget, then the next question comes.
 * Returns whether the chip is still by the reaction.
 */
export function useReaction(reacting: boolean, reduce: boolean, onSettled: () => void, onDone: () => void): boolean {
  const [chipHere, setChipHere] = useState(true);
  useEffect(() => {
    if (!reacting) return;
    const fly = setTimeout(
      () => {
        setChipHere(false);
        onSettled();
      },
      reduce ? 0 : CHIP_HOLD_MS,
    );
    const next = setTimeout(onDone, REACTION_MS + (reduce ? 0 : CHIP_HOLD_MS));
    return () => {
      clearTimeout(fly);
      clearTimeout(next);
    };
  }, [reacting, reduce, onSettled, onDone]);
  return chipHere;
}

/** The sample team answers: typed out a character at a time, then sent. */
export function useAutoAnswer({
  autoAnswer,
  frozen,
  asking,
  talking,
  reduce,
  setText,
  submit,
}: {
  autoAnswer: string | undefined;
  frozen: boolean;
  asking: boolean;
  talking: boolean;
  reduce: boolean;
  setText: (t: string) => void;
  submit: (t: string) => void;
}) {
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (!autoAnswer || frozen || !asking || talking) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      i = reduce ? autoAnswer.length : i + 1;
      setText(autoAnswer.slice(0, i));
      t = i < autoAnswer.length ? setTimeout(step, AUTO_CHAR_MS) : setTimeout(() => submitRef.current(autoAnswer), 500);
    };
    t = setTimeout(step, reduce ? 0 : AUTO_START_MS);
    return () => clearTimeout(t);
  }, [autoAnswer, frozen, asking, talking, reduce, setText]);
}

/**
 * Keeps the timer and field in view above a phone keyboard. The keyboard resizes the viewport
 * (resizes-content, or the visual viewport on iOS) after focus, so this follows that.
 */
export function useKeepInView(
  inputRef: React.RefObject<HTMLTextAreaElement | null>,
  formRef: React.RefObject<HTMLFormElement | null>,
  reduce: boolean,
) {
  const keepInView = useCallback(() => {
    if (document.activeElement !== inputRef.current) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    formRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [inputRef, formRef, reduce]);
  useEffect(() => {
    const vv = window.visualViewport;
    window.addEventListener("resize", keepInView);
    vv?.addEventListener("resize", keepInView);
    return () => {
      window.removeEventListener("resize", keepInView);
      vv?.removeEventListener("resize", keepInView);
    };
  }, [keepInView]);
  return keepInView;
}
