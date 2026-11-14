"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { RepoForm } from "@/components/landing/repo-form";
import { buttonVariants } from "@/components/ui/button";
import { copy, fill } from "@/lib/copy";
import { eventStatus } from "@/lib/events";

const E = copy.events;
const noop = () => () => {};

/**
 * The form while the event is open; after the deadline, a closed note in its place (the page
 * stays up). Decided in the browser against the real clock, so a cached page never lets a
 * late entry in; the server checks again when the session starts.
 */
export function EventEntry({
  slug,
  name,
  startsAt,
  endsAt,
  tracks,
}: {
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  tracks: readonly string[];
}) {
  const status = useSyncExternalStore(
    noop,
    () => eventStatus({ startsAt, endsAt }, Date.now()),
    () => null,
  );
  if (status === null) return <div className="min-h-[140px]" aria-hidden />;
  if (status === "open") return <RepoForm eventSlug={slug} tracks={tracks} className="mt-2" />;
  return (
    <div className="max-w-[676px] rounded-panel border border-border bg-surface p-5">
      <p className="text-[17px] leading-snug font-semibold">
        {fill(status === "closed" ? E.closed : E.upcoming, { name })}
      </p>
      <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-4" })}>
        {E.withoutEvent}
      </Link>
    </div>
  );
}
