import { RepoForm } from "@/components/landing/repo-form";
import { copy } from "@/lib/copy";

/** The last thing on the page: the form again. */
export function FinalCta() {
  return (
    <section aria-labelledby="final-heading" className="page-x border-t border-border py-20 lg:py-28">
      <h2 id="final-heading" className="text-[44px] leading-[0.95] font-black tracking-[-0.045em] lg:text-[72px]">
        {copy.landing.final}
      </h2>
      <RepoForm id="final-repo" className="mt-10 lg:mt-12" />
    </section>
  );
}
