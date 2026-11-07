import { Headline } from "@/components/landing/headline";
import { RepoForm } from "@/components/landing/repo-form";
import { YesterdaysBoard } from "@/components/landing/yesterdays-board";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { copy } from "@/lib/copy";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-x grid flex-1 content-start gap-16 pt-10 pb-20 lg:grid-cols-[minmax(0,1fr)_424px] lg:gap-20 lg:pt-14">
        <section>
          <Headline />
          <p className="mt-8 max-w-[520px] text-[19px] leading-[1.45] text-text-muted lg:mt-10 lg:text-[22px]">
            {copy.landing.subhead}
          </p>
          <RepoForm />
        </section>
        <div className="lg:pt-12">
          <YesterdaysBoard />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
