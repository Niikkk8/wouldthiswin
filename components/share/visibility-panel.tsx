"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { copy } from "@/lib/copy";
import type { Visibility } from "@/lib/session";

const V = copy.acts.share.visibility;
const Reply = z.object({ shareable: z.boolean(), listed: z.boolean() });

/** The owner's two opt-ins, both off until they turn them on: a public link, and the public board. */
export function VisibilityPanel({ id, value, onChange }: { id: string; value: Visibility; onChange: (v: Visibility) => void }) {
  const [saving, setSaving] = useState(false);

  async function save(change: Partial<Visibility>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${id}/visibility`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
      const parsed = Reply.safeParse(await res.json().catch(() => null));
      if (!res.ok || !parsed.success) throw new Error(String(res.status));
      onChange(parsed.data);
    } catch {
      toast.error(copy.errors.network);
    } finally {
      setSaving(false);
    }
  }

  const row = (key: keyof Visibility, label: string, note: string, disabled: boolean) => (
    <div className="flex items-start gap-3">
      <Checkbox
        id={`vis-${key}`}
        checked={value[key]}
        disabled={disabled || saving}
        onCheckedChange={(v) => void save({ [key]: v === true })}
        aria-describedby={`vis-${key}-note`}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <label htmlFor={`vis-${key}`} className="text-[16px] font-semibold">
          {label}
        </label>
        <p id={`vis-${key}-note`} className="mt-0.5 text-[14px] leading-snug text-pretty text-text-subtle">
          {note}
        </p>
      </div>
    </div>
  );

  return (
    <section aria-labelledby="visibility" className="grid gap-4 rounded-panel border border-border bg-surface p-5">
      <h2 id="visibility" className="label-mono uppercase">
        {V.heading}
      </h2>
      {row("shareable", V.shareable, V.shareableNote, false)}
      {row("listed", V.listed, V.listedNote, !value.shareable)}
    </section>
  );
}
