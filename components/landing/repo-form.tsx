"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy } from "@/lib/copy";
import { parseRepoUrl } from "@/lib/repo-url";

export function RepoForm() {
  const router = useRouter();
  const [repo, setRepo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!parseRepoUrl(repo)) {
      setInvalid(true);
      toast.error(copy.errors.invalidUrl);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: repo }),
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
