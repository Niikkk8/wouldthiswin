import { CheckList } from "@/components/check-list";
import { Ghost } from "@/components/ghost";
import { HeroBoard } from "@/components/hero-board";
import { JudgeForm } from "@/components/judge-form";
import { IndexCards } from "@/components/index-cards";
import { JudgingNotes } from "@/components/judging-notes";
import { MarkerHeadline } from "@/components/marker-headline";
import { SiteNav } from "@/components/site-nav";
import { SwingingBadge } from "@/components/swinging-badge";
import { copy } from "@/lib/copy";

const MARKER_DISPLAY = "font-marker text-[3.9rem] leading-[0.92] sm:text-[6.5rem] lg:text-[7.5rem]";
const { hero, examples } = copy.home;

type Example = { pitch: string; roast: string };

function ExampleCaption({ ex, className = "" }: { ex: Example; className?: string }) {
  return (
    <figcaption className={`max-w-[17rem] ${className}`}>
      <p className="text-sm font-bold">{copy.home.exampleLabel}</p>
      <p className="text-sm text-graphite">{ex.pitch}</p>
      <p className="mt-2.5 font-semibold leading-snug text-pretty">{ex.roast}</p>
    </figcaption>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-hand text-3xl font-bold sm:text-4xl">{children}</h2>;
}

export default function Home() {
  return (
    <>
      <HeroBoard>
        <div className="mx-auto max-w-7xl px-4 sm:px-10">
          <SiteNav />
          <div className="relative isolate grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <Ghost variant="idea" className="left-[46%] top-[64%] hidden w-72 lg:block" />
            <section className="pt-8 sm:pt-12 lg:pt-16">
              <MarkerHeadline text={copy.home.headline} className={MARKER_DISPLAY} />
              <p className="mt-5 max-w-md text-lg leading-snug text-graphite text-pretty sm:mt-8 sm:text-xl">
                {copy.home.subhead}
              </p>
              <div id="judge" className="mt-7 max-w-lg scroll-mt-8 sm:mt-10">
                <JudgeForm shortcut />
              </div>
            </section>

            <figure className="mt-14 flex flex-col items-center lg:mt-0">
              <div className="[zoom:0.72] sm:[zoom:0.85] lg:[zoom:1]">
                <SwingingBadge
                  repo={hero.repo}
                  overall={hero.overall}
                  verdict={hero.verdict}
                  width={380}
                  lanyard={150}
                  release={-16}
                  follow
                />
              </div>
              <ExampleCaption ex={hero} className="mt-10 self-center lg:self-start lg:pl-2" />
            </figure>
          </div>
        </div>
      </HeroBoard>

      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-10 sm:pb-32">
        <section id="how-judging-works" className="relative isolate mt-24 scroll-mt-8 sm:mt-36">
          <Ghost variant="sketch" className="-top-14 right-0 hidden w-80 sm:block" />
          <h2 className={`${MARKER_DISPLAY} max-w-4xl`}>{copy.judging.heading}</h2>
          <div className="mt-14 sm:mt-20">
            <JudgingNotes />
          </div>
        </section>

        <section
          id="what-you-get"
          className="mt-28 grid scroll-mt-8 gap-10 sm:mt-44 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
        >
          <div>
            <h2 className="max-w-md font-hand text-4xl font-bold leading-[1.1] text-balance sm:text-5xl">
              {copy.getBack.heading}
            </h2>
            <p className="mt-4 text-lg text-graphite">{copy.getBack.subhead}</p>
          </div>
          <div className="lg:pt-3">
            <CheckList items={copy.getBack.items} />
          </div>
        </section>

        <section
          id="examples"
          className="mx-auto mt-28 grid max-w-3xl scroll-mt-8 justify-items-center gap-y-20 sm:mt-44 sm:grid-cols-2 sm:gap-x-12"
        >
          {examples.map((ex) => (
            <figure
              key={ex.repo}
              className="grid w-[300px] grid-rows-[auto_1fr] justify-items-center"
            >
              <div className="flex items-start sm:h-[620px]">
                <SwingingBadge
                  repo={ex.repo}
                  overall={ex.overall}
                  verdict={ex.verdict}
                  width={300}
                  lanyard={130}
                  nudge
                />
              </div>
              <ExampleCaption ex={ex} className="w-full" />
            </figure>
          ))}
        </section>

        <aside className="mt-24 flex justify-center sm:mt-32 lg:justify-end lg:pr-24">
          <div className="grain relative w-[min(19rem,85vw)] rotate-[1.5deg] bg-white px-6 pb-6 pt-7 shadow-[0_1px_1px_rgb(0_0_0/0.12),0_3px_6px_-3px_rgb(0_0_0/0.2)] transition-transform duration-300 hover:rotate-0">
            <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-2" aria-hidden="true" />
            <p className="font-hand text-[1.3rem] leading-snug">{copy.aboutNote}</p>
          </div>
        </aside>

        <section className="mt-24 max-w-4xl sm:mt-32">
          <SectionHeading>{copy.finePrint.heading}</SectionHeading>
          <div className="mt-10">
            <IndexCards />
          </div>
        </section>

        <section className="mt-24 max-w-xl sm:mt-32">
          <SectionHeading>{copy.finalCall.heading}</SectionHeading>
          <p className="mt-3 text-lg text-graphite text-pretty">{copy.finalCall.subhead}</p>
          <div className="mt-7">
            <JudgeForm compact />
          </div>
        </section>
      </div>
    </>
  );
}
