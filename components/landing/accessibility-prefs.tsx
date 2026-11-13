"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { copy } from "@/lib/copy";

const P = copy.landing.prefs;
const Prefs = z.object({ extendedTime: z.boolean() });

/**
 * Extended time: every answer window doubled, no penalty. Saved for this browser and copied
 * onto each session it starts, so the server's clock uses it. It never shows on a review.
 */
export function AccessibilityPrefs({ id }: { id: string }) {
  const [extended, setExtended] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (extended !== null) return;
    try {
      const parsed = Prefs.safeParse(await (await fetch("/api/prefs")).json());
      setExtended(parsed.success ? parsed.data.extendedTime : false);
    } catch {
      setExtended(false);
    }
  }

  async function save(next: boolean) {
    const before = extended;
    setExtended(next);
    setSaving(true);
    try {
      const res = await fetch("/api/prefs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extendedTime: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setExtended(before);
      toast.error(copy.errors.network);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group mt-2" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void load()}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[14px] text-text-muted underline decoration-1 underline-offset-4 hover:text-text [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden size={15} strokeWidth={1.75} className="transition-transform duration-200 group-open:rotate-90" />
        {P.toggle}
      </summary>
      <div className="mt-3 flex items-start gap-3">
        <Checkbox
          id={`${id}-extended`}
          checked={extended === true}
          disabled={extended === null || saving}
          onCheckedChange={(v) => void save(v === true)}
          aria-describedby={`${id}-extended-note`}
          className="mt-0.5"
        />
        <div>
          <label htmlFor={`${id}-extended`} className="text-[15px] font-semibold">
            {P.extended}
          </label>
          <p id={`${id}-extended-note`} className="mt-0.5 text-[13px] text-text-subtle">
            {P.extendedNote}
          </p>
        </div>
      </div>
    </details>
  );
}
