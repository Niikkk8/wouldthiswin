"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy } from "@/lib/copy";
import { parseDemoLink } from "@/lib/demo-link";
import { parseRepoUrl } from "@/lib/repo-url";
import { ChevronRight } from "lucide-react";

export function RepoForm() {
  const router = useRouter();
  const [repo, setRepo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demo, setDemo] = useState("");
  const [demoInvalid, setDemoInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!parseRepoUrl(repo)) {
      setInvalid(true);
      toast.error(copy.errors.invalidUrl);
      return;
    }
    const demoUrl = demoOpen && demo.trim() ? parseDemoLink(demo)?.url : undefined;
    if (demoOpen && demo.trim() && !demoUrl) {
      setDemoInvalid(true);
      toast.error(copy.errors.invalidDemo);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: repo, ...(demoUrl ? { demoUrl } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.id) {
        toast.error(body.message ?? copy.errors.judgeFailed);
        setPending(false);
        return;
      }
      router.push(`/s/${body.id}`);
    } catch {
      toast.error(copy.errors.network);
      setPending(false);
    }
  }

  return (
    <form onSubmit={start} className="mt-10 max-w-[676px] lg:mt-12" noValidate>
      <Label htmlFor="repo">{copy.landing.repoLabel}</Label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Input
          id="repo"
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            setInvalid(false);
          }}
          placeholder={copy.landing.placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby="repo-note"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
          className="sm:flex-1"
        />
        <Button type="submit" disabled={pending} className="h-[60px] sm:w-[189px]">
          {pending ? copy.landing.starting : copy.landing.button}
        </Button>
      </div>
      <p id="repo-note" className="mt-3 text-[14px] text-text-muted">
        {copy.landing.underButton}
      </p>
      {/* A native disclosure: it opens even before React has hydrated. */}
      <details
        className="group mt-4"
        onToggle={(e) => setDemoOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[14px] text-text-muted underline decoration-1 underline-offset-4 hover:text-text [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            size={15}
            strokeWidth={1.75}
            className="transition-transform duration-200 group-open:rotate-90"
          />
          {copy.landing.demoToggle}
        </summary>
        <div className="mt-3">
          <Label htmlFor="demo" className="sr-only">
            {copy.landing.demoLabel}
          </Label>
          <Input
            id="demo"
            value={demo}
            onChange={(e) => {
              setDemo(e.target.value);
              setDemoInvalid(false);
            }}
            placeholder={copy.landing.demoPlaceholder}
            aria-invalid={demoInvalid || undefined}
            aria-describedby="demo-note"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            className="h-12 text-[15px]"
          />
          <p id="demo-note" className="mt-2 text-[13px] text-text-subtle">
            {copy.landing.demoNote}
          </p>
        </div>
      </details>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-disabled
            className="mt-7 cursor-not-allowed text-[16px] font-bold text-text-subtle underline decoration-1 underline-offset-[6px]"
          >
            {copy.landing.versus}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{copy.landing.versusSoon}</TooltipContent>
      </Tooltip>
    </form>
  );
}
