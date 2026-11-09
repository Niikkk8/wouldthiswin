"use client";

import { copy } from "@/lib/copy";
import "./globals.css";

/** When the root layout itself fails: no fonts or providers, same look. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <main id="main" tabIndex={-1} className="page-x pt-24 pb-24">
          <p className="max-w-2xl text-[36px] leading-none font-black tracking-[-0.04em] lg:text-act">
            {copy.serverError.message}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="h-12 rounded-control bg-text px-6 text-[17px] font-bold text-bg"
            >
              {copy.serverError.retry}
            </button>
            {/* A plain link: the router may be the thing that failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="flex h-12 items-center rounded-control border border-border-strong px-6 text-[17px] font-bold">
              {copy.serverError.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
