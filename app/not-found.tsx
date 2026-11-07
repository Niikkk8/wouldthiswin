import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-x flex-1 pt-16 pb-24 lg:pt-24">
        <p className="max-w-2xl text-[36px] leading-none font-black tracking-[-0.04em] text-balance lg:text-act">
          {copy.notFoundPage.message}
        </p>
        <Link href="/" className={`mt-10 ${buttonVariants()}`}>
          {copy.notFoundPage.button}
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
