import Link from "next/link";
import { copy } from "@/lib/copy";
import type { StoredJudgment } from "@/lib/results";
import { repoName } from "@/lib/results";
import { BreaksFirstNote } from "./breaks-first-note";
import { ClaimsList } from "./claims-list";
import { FixNote } from "./fix-note";
import { HangingBadge } from "./hanging-badge";
import { ScoreBreakdown } from "./score-breakdown";

export function ResultView({ judgment }: { judgment: StoredJudgment }) {
  const { result, signals } = judgment;
  const deadDemo = signals.demo.provided && !signals.demo.loads;

  return (
    <div className="grid gap-x-20 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex justify-center lg:justify-start">
        <HangingBadge
          repo={repoName(judgment.repoUrl)}
          overall={result.overall}
          verdict={result.verdict}
          width={280}
          lanyard={120}
          animate
        />
      </div>

      <div className="mt-14 lg:mt-0 lg:pt-12">
        <Link
          href="/"
          className="hidden text-sm font-semibold underline-offset-4 hover:underline lg:inline"
        >
          {copy.home.headline}
        </Link>
        {/* Results stored before claims/oneLiner/breaksFirst existed fall back to the roast. */}
        <blockquote className="mt-0 text-[1.75rem] font-semibold leading-tight text-balance sm:text-[2.25rem] lg:mt-6">
          {result.oneLiner ?? result.roast}
        </blockquote>
        {result.oneLiner && <p className="mt-4 text-xl text-pretty">{result.roast}</p>}
        <p className="mt-3 text-lg text-graphite text-pretty">{copy.verdicts[result.verdict]}</p>
        {deadDemo && (
          <p className="mt-4 border-l-[3px] border-marker-red pl-3 font-medium">
            {copy.deadDemoNote}
          </p>
        )}

        <div className="mt-10 grid items-start gap-12 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] xl:gap-14">
          <ScoreBreakdown scores={result.scores} />
          {result.claims?.length ? <ClaimsList claims={result.claims} /> : null}
        </div>

        <div className="mt-14 grid items-start gap-10 md:grid-cols-2 md:gap-8">
          <FixNote fixes={result.fixes} />
          {result.breaksFirst && <BreaksFirstNote text={result.breaksFirst} />}
        </div>
      </div>
    </div>
  );
}
