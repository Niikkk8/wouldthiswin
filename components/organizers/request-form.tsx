"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

const F = copy.organizers.form;
const FIELDS = ["name", "url", "startsAt", "endsAt", "contact"] as const;
const AREAS = ["rubric", "tracks"] as const;
type Field = (typeof FIELDS)[number] | (typeof AREAS)[number];

/** "Add your hackathon": what Niket needs to turn an event into a preset. */
export function RequestForm() {
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    url: "",
    startsAt: "",
    endsAt: "",
    contact: "",
    rubric: "",
    tracks: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  if (state === "sent") {
    return (
      <p
        role="status"
        className="max-w-[620px] rounded-panel border border-border bg-surface p-5 text-[17px]"
      >
        {F.sent}
      </p>
    );
  }

  return (
    <form
      className="grid max-w-[620px] gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        const res = await fetch("/api/organizers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        }).catch(() => null);
        if (res?.ok) return setState("sent");
        setState("idle");
        toast.error(res?.status === 400 ? F.invalid : copy.errors.network);
      }}
    >
      {FIELDS.map((f) => (
        <div key={f}>
          <Label htmlFor={`org-${f}`}>{F.labels[f]}</Label>
          <Input
            id={`org-${f}`}
            className="mt-2 h-12 text-[15px]"
            value={values[f]}
            onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
            required={f === "name" || f === "url" || f === "contact"}
            type={f === "url" ? "url" : "text"}
            placeholder={F.placeholders[f]}
            autoComplete="off"
          />
        </div>
      ))}
      {AREAS.map((f) => (
        <div key={f}>
          <Label htmlFor={`org-${f}`}>{F.labels[f]}</Label>
          <textarea
            id={`org-${f}`}
            rows={4}
            value={values[f]}
            onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
            placeholder={F.placeholders[f]}
            className="mt-2 w-full resize-y rounded-control border border-border-strong bg-surface px-4 py-3 text-[15px] text-text placeholder:text-text-subtle"
          />
        </div>
      ))}
      <Button type="submit" disabled={state === "sending"} className="w-full sm:w-auto">
        {state === "sending" ? F.sending : F.submit}
      </Button>
    </form>
  );
}
