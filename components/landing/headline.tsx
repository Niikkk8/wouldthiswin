"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { copy } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** "Would this win?", one word at a time, 60ms apart. */
export function Headline() {
  const reduce = useReducedMotion();
  const [a, b, c] = copy.landing.headline;
  const word = (w: string, i: number) =>
    reduce ? (
      <span>{w}</span>
    ) : (
      <BlurFade
        key={w}
        delay={i * 0.06}
        duration={0.5}
        offset={12}
        direction="up"
        className="inline-block"
        transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}
      >
        {w}
      </BlurFade>
    );
  return (
    <h1 className="text-[64px] leading-[0.88] font-black tracking-[-0.05em] sm:text-[96px] lg:text-hero">
      {word(a, 0)} {word(b, 1)}
      <br />
      {word(c, 2)}
    </h1>
  );
}
