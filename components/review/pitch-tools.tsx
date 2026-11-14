"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { copy, fill } from "@/lib/copy";
import type { Pitch } from "@/lib/pitch";

const P = copy.pitch;
type Tab = "readme" | "submission";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** The owner's README skeleton and submission draft, from what the code backs. */
export function PitchTools({ pitch, repo }: { pitch: Pitch; repo: string }) {
  const [tab, setTab] = useState<Tab>("readme");
  const text = tab === "readme" ? pitch.readme : pitch.submission;
  const slug = repo.split("/").pop() ?? "project";
  return (
    <section aria-labelledby="pitch" className="rounded-panel border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <h2 id="pitch" className="text-[17px] font-bold">
          {P.heading}
        </h2>
        <p className="mt-1 text-[14px] text-text-subtle">{P.note}</p>
        <div
          role="tablist"
          aria-label={P.heading}
          className="mt-4 inline-flex rounded-control border border-border-strong p-1"
        >
          {(["readme", "submission"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="rounded-[6px] px-3 py-1.5 text-[14px] font-bold text-text-muted transition-colors hover:text-text aria-selected:bg-surface-2 aria-selected:text-text"
            >
              {P.tabs[t]}
            </button>
          ))}
        </div>
      </header>
      <div role="tabpanel" className="px-5 py-4">
        <pre className="max-h-[420px] overflow-auto rounded-control bg-bg p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-text-muted">
          {text}
        </pre>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton value={text} label={P.tabs[tab]} idle={P.copy} />
          <button
            type="button"
            onClick={() => download(tab === "readme" ? "README.md" : `${slug}-submission.md`, text)}
            className={cn(buttonVariants({ variant: "secondary" }), "h-10 gap-2 px-3 text-[14px]")}
          >
            <Download aria-hidden size={16} strokeWidth={1.75} />
            {P.download}
          </button>
          {tab === "submission" && (
            <span className="label-mono ml-1 tabular-nums">
              {fill(P.words, { n: pitch.words })}
            </span>
          )}
        </div>
        {pitch.leftOut.length > 0 && (
          <div className="mt-5">
            <h3 className="label-mono uppercase">{P.leftOut}</h3>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-[15px] text-text-muted">
              {pitch.leftOut.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
