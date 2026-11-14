import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaptureLoader } from "@/components/capture/capture-loader";
import { CAPTURE_ACTS, type CaptureAct } from "@/lib/demo/capture-acts";

// Dev only: each act of the PulseBoard session on fixture data, for recording the demo videos.
// Never linked, disallowed in robots.txt, and a 404 in production.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CapturePage(props: PageProps<"/capture/[act]">) {
  return (
    <Suspense>
      <Capture {...props} />
    </Suspense>
  );
}

async function Capture({ params }: PageProps<"/capture/[act]">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { act } = await params;
  if (!(CAPTURE_ACTS as readonly string[]).includes(act)) notFound();
  return <CaptureLoader act={act as CaptureAct} />;
}
