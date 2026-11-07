"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/** A page that threw. The session itself is saved on the server, so "Try again" resumes it. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-x flex-1 pt-16 pb-24 lg:pt-24">
        <p className="max-w-2xl text-[36px] leading-none font-black tracking-[-0.04em] text-balance lg:text-act">
          {copy.serverError.message}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button onClick={reset}>{copy.serverError.retry}</Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            {copy.serverError.home}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
