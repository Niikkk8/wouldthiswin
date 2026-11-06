import Link from "next/link";
import { copy } from "@/lib/copy";

export function SiteNav() {
  const link = "text-sm font-semibold underline-offset-4 hover:underline";
  return (
    <nav className="flex items-center justify-between gap-4 pt-5 sm:pt-7">
      <Link href="/" className="font-marker text-xl sm:text-2xl">
        {copy.nav.brand}
      </Link>
      <div className="flex items-center gap-7">
        <a href="#how-judging-works" className={`${link} hidden md:inline`}>
          {copy.nav.judging}
        </a>
        <a href="#what-you-get" className={`${link} hidden lg:inline`}>
          {copy.nav.getBack}
        </a>
        <a href="#examples" className={`${link} hidden md:inline`}>
          {copy.nav.examples}
        </a>
        <a href="#judge" className="chunky chunky-sm px-3.5 py-2 text-sm font-bold">
          {copy.nav.cta}
        </a>
      </div>
    </nav>
  );
}
