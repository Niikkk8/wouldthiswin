import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResultView } from "@/components/result-view";
import { copy } from "@/lib/copy";
import { getJudgment } from "@/lib/results";

export default function ResultPage({ params }: PageProps<"/r/[id]">) {
  return (
    <div className="mx-auto flex pb-24 max-w-6xl flex-col px-4 sm:px-8">
      <Link
        href="/"
        className="pt-5 text-sm font-semibold underline-offset-4 hover:underline lg:hidden"
      >
        {copy.home.headline}
      </Link>
      <Suspense fallback={<div className="min-h-[38rem]" aria-hidden="true" />}>
        <Result params={params} />
      </Suspense>
    </div>
  );
}

async function Result({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const judgment = await getJudgment(id);
  if (!judgment) notFound();
  return <ResultView judgment={judgment} />;
}
