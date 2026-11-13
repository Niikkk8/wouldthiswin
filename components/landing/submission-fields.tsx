"use client";

import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { MAX_SUBMISSION_CHARS } from "@/lib/evidence/devpost-url";

const S = copy.landing.submission;

export type SubmissionValue = { devpost: string; text: string; start: string; end: string };

/** Optional claim sources beyond the README. A native disclosure, so it opens before hydration. */
export function SubmissionFields({
  id,
  value,
  onChange,
  devpostInvalid,
}: {
  id: string;
  value: SubmissionValue;
  onChange: (v: SubmissionValue) => void;
  devpostInvalid: boolean;
}) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[14px] text-text-muted underline decoration-1 underline-offset-4 hover:text-text [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden size={15} strokeWidth={1.75} className="transition-transform duration-200 group-open:rotate-90" />
        {S.toggle}
      </summary>
      <div className="mt-3 grid gap-3">
        <div>
          <Label htmlFor={`${id}-devpost`} className="text-[13px]">
            {S.devpostLabel}
          </Label>
          <Input
            id={`${id}-devpost`}
            value={value.devpost}
            onChange={(e) => onChange({ ...value, devpost: e.target.value })}
            placeholder={S.devpostPlaceholder}
            aria-invalid={devpostInvalid || undefined}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            className="mt-2 h-12 text-[15px]"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-text`} className="text-[13px]">
            {S.textLabel}
          </Label>
          <textarea
            id={`${id}-text`}
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value.slice(0, MAX_SUBMISSION_CHARS) })}
            placeholder={S.textPlaceholder}
            rows={4}
            maxLength={MAX_SUBMISSION_CHARS}
            aria-describedby={`${id}-sub-note`}
            className="mt-2 w-full resize-y rounded-control border border-border-strong bg-surface px-4 py-3 text-[15px] leading-snug text-text placeholder:text-text-subtle"
          />
        </div>
        <p id={`${id}-sub-note`} className="text-[13px] text-text-subtle">
          {S.note}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["start", "end"] as const).map((k) => (
            <div key={k}>
              <Label htmlFor={`${id}-${k}`} className="text-[13px]">
                {S[k]}
              </Label>
              <Input
                id={`${id}-${k}`}
                type="datetime-local"
                value={value[k]}
                onChange={(e) => onChange({ ...value, [k]: e.target.value })}
                aria-describedby={`${id}-window-note`}
                className="mt-2 h-12 text-[15px]"
              />
            </div>
          ))}
        </div>
        <p id={`${id}-window-note`} className="text-[13px] text-text-subtle">
          {S.windowNote}
        </p>
      </div>
    </details>
  );
}
