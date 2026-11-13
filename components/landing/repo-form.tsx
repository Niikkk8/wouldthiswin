"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { JudgesAsleep } from "@/components/judges-asleep";
import { copy } from "@/lib/copy";
import { parseDemoLink } from "@/lib/demo-link";
import { parseRepoUrl } from "@/lib/repo-url";
import { startSession, type AsleepInfo } from "@/lib/start-session";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";

/** "Challenge a friend" isn't built yet: the link stays in the code, off the page. */
const SHOW_VERSUS = false;

/** Linking to `/#repo` lands on the hero form with the field focused. */
export const REPO_FOCUS = "repo";

/** The repo field. `id` keeps the field ids unique when the page has the form twice. */
export function RepoForm({ id = "repo", eventSlug, className }: { id?: string; eventSlug?: string; className?: string }) {
  const ids = { repo: id, note: `${id}-note`, demo: `${id}-demo`, demoNote: `${id}-demo-note` };
  const router = useRouter();
  const [repo, setRepo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demo, setDemo] = useState("");
  const [demoInvalid, setDemoInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [asleep, setAsleep] = useState<AsleepInfo | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id !== REPO_FOCUS) return;
    let raf = 0;
    // After the browser's own jump to the anchor: show the whole hero, then focus the field.
    const focus = () => {
      if (window.location.hash !== `#${REPO_FOCUS}`) return;
      raf = requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        input.current?.focus({ preventScroll: true });
      });
    };
    focus();
    window.addEventListener("hashchange", focus);
    return () => {
      window.removeEventListener("hashchange", focus);
      cancelAnimationFrame(raf);
    };
  }, [id]);

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
    const r = await startSession({ repoUrl: repo, ...(demoUrl ? { demoUrl } : {}), ...(eventSlug ? { eventSlug } : {}) });
    if (r.kind === "started") return router.push(`/s/${r.id}`);
    setPending(false);
    if (r.kind === "asleep") setAsleep(r.asleep);
    else toast.error(r.message);
  }

  if (asleep) return <JudgesAsleep info={asleep} className={className} />;

  return (
    <form onSubmit={start} className={cn("max-w-[676px]", className)} noValidate>
      <Label htmlFor={ids.repo}>{copy.landing.repoLabel}</Label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Input
          ref={input}
          id={ids.repo}
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            setInvalid(false);
          }}
          placeholder={copy.landing.placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={ids.note}
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
          className="sm:flex-1"
        />
        <Button type="submit" disabled={pending} className="h-[60px] sm:w-[189px]">
          {pending ? copy.landing.starting : copy.landing.button}
        </Button>
      </div>
      <p id={ids.note} className="mt-3 text-[14px] text-text-muted">
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
          <Label htmlFor={ids.demo} className="sr-only">
            {copy.landing.demoLabel}
          </Label>
          <Input
            id={ids.demo}
            value={demo}
            onChange={(e) => {
              setDemo(e.target.value);
              setDemoInvalid(false);
            }}
            placeholder={copy.landing.demoPlaceholder}
            aria-invalid={demoInvalid || undefined}
            aria-describedby={ids.demoNote}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            className="h-12 text-[15px]"
          />
          <p id={ids.demoNote} className="mt-2 text-[13px] text-text-subtle">
            {copy.landing.demoNote}
          </p>
        </div>
      </details>
      {SHOW_VERSUS && (
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
      )}
    </form>
  );
}
