import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SessionShell } from "@/components/session/session-shell";
import { SiteHeader } from "@/components/site-header";
import { loadView } from "@/lib/session-store";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SessionPage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<SiteHeader />}>
      <Session params={params} />
    </Suspense>
  );
}

/** Resumes at whatever act the server says the session is in. */
async function Session({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  const view = await loadView(id);
  if (!view) notFound();
  return <SessionShell initial={view} />;
}
