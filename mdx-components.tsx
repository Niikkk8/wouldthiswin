import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { CopyPre } from "@/components/guides/copy-pre";

// The guides' typography, in the site's design system. @next/mdx requires this file at the
// root; every MDX file renders through it.

const components: MDXComponents = {
  h2: (p) => (
    <h2
      className="mt-14 text-[28px] leading-tight font-black tracking-[-0.03em] text-balance lg:text-[34px]"
      {...p}
    />
  ),
  h3: (p) => (
    <h3 className="mt-10 text-[21px] leading-snug font-extrabold tracking-[-0.02em]" {...p} />
  ),
  p: (p) => <p className="mt-5 text-[18px] leading-[1.65] text-text-muted" {...p} />,
  ul: (p) => (
    <ul
      className="mt-5 grid list-disc gap-2 pl-6 text-[18px] leading-[1.6] text-text-muted marker:text-text-subtle"
      {...p}
    />
  ),
  ol: (p) => (
    <ol
      className="mt-5 grid list-decimal gap-2 pl-6 text-[18px] leading-[1.6] text-text-muted marker:font-mono marker:text-text-subtle"
      {...p}
    />
  ),
  li: (p) => <li className="pl-1" {...p} />,
  strong: (p) => <strong className="font-bold text-text" {...p} />,
  em: (p) => <em className="italic" {...p} />,
  a: ({ href = "", ...p }) =>
    href.startsWith("/") ? (
      <Link
        href={href}
        className="text-text underline underline-offset-4 hover:text-text-muted"
        {...p}
      />
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="text-text underline underline-offset-4 hover:text-text-muted"
        {...p}
      />
    ),
  blockquote: (p) => (
    <blockquote
      className="mt-8 border-l-2 border-border-strong pl-5 text-[22px] leading-snug font-bold text-text [&_p]:mt-0 [&_p]:text-inherit"
      {...p}
    />
  ),
  code: (p) => (
    <code
      className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-mono text-[0.88em] text-text"
      {...p}
    />
  ),
  pre: (p) => <CopyPre {...p} />,
  hr: () => <hr className="mt-12 border-border" />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
