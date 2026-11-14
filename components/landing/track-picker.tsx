"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { copy } from "@/lib/copy";

const S = copy.landing.submission;

/** An event's sponsor tracks, for the team to say which ones it's entering. */
export function TrackPicker({
  id,
  tracks,
  value,
  onChange,
}: {
  id: string;
  tracks: readonly string[];
  value: readonly string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-[14px] font-semibold">{S.tracks}</legend>
      <p className="mt-0.5 text-[13px] text-text-subtle">{S.tracksNote}</p>
      <div className="mt-3 grid gap-2">
        {tracks.map((t, i) => (
          <div key={t} className="flex items-start gap-3">
            <Checkbox
              id={`${id}-track-${i}`}
              checked={value.includes(t)}
              onCheckedChange={(v) =>
                onChange(v === true ? [...value, t] : value.filter((x) => x !== t))
              }
              className="mt-0.5"
            />
            <label htmlFor={`${id}-track-${i}`} className="text-[15px] leading-snug">
              {t}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
