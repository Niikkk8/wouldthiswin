import { Headline } from "@/components/landing/headline";
import { HeroMoment } from "@/components/landing/hero-moment";
import { FinalCta } from "@/components/landing/final-cta";
import { FinePrint } from "@/components/landing/fine-print";
import { MeetThePanel } from "@/components/landing/meet-the-panel";
import { RepoForm } from "@/components/landing/repo-form";
import { SampleSession } from "@/components/landing/sample-session";
import { WalkAway } from "@/components/landing/walk-away";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy } from "@/lib/copy";
import { webApplication } from "@/lib/structured-data";

// Yesterday's board (components/landing/yesterdays-board.tsx) stays off the page until the
// board exists.

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={webApplication()} />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1">
        {/* The hero fills one screen on desktop, demo field open or not: sizes follow the viewport's height. */}
        <section className="page-x grid gap-6 pt-6 pb-16 lg:pt-[clamp(8px,3vh,40px)] xl:h-[calc(100svh-80px)] xl:min-h-[600px] xl:grid-cols-[minmax(0,1fr)_auto] xl:content-center xl:items-center xl:gap-8 2xl:gap-16 xl:py-0">
          <div className="min-w-0">
            <Headline />
            <p className="mt-8 max-w-[520px] text-[19px] leading-[1.45] text-text-muted lg:mt-[clamp(14px,3.2vh,40px)] lg:text-[clamp(18px,2.5vh,22px)]">
              {copy.landing.subhead}
            </p>
            <RepoForm className="mt-10 lg:mt-[clamp(18px,4vh,48px)]" />
          </div>
          <HeroMoment />
        </section>
        {/* Every section's words are in the HTML; only the animations and the acts load later. */}
        <MeetThePanel />
        <SampleSession />
        <WalkAway />
        <FinePrint />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
