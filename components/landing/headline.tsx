import { copy } from "@/lib/copy";

/**
 * "Would this win?", one word at a time, 60ms apart. A CSS animation, so the words are in
 * the HTML and start on first paint; reduced motion shows them at once.
 */
export function Headline() {
  const [a, b, c] = copy.landing.headline;
  const word = (w: string, i: number) => (
    <span className="word-in" style={{ animationDelay: `${i * 60}ms` }}>
      {w}
    </span>
  );
  return (
    <h1 className="text-[64px] leading-[0.88] font-black tracking-[-0.05em] sm:text-[96px] lg:text-[clamp(72px,14.5vh,128px)]">
      {word(a, 0)} {word(b, 1)}
      <br />
      {word(c, 2)}
    </h1>
  );
}
