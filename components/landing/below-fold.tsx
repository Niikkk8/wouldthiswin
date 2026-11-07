"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// Everything under the hero loads when it's about to scroll into view: its code included.
const MeetThePanel = dynamic(() => import("./meet-the-panel").then((m) => m.MeetThePanel), { ssr: false });
const SampleSession = dynamic(() => import("./sample-session").then((m) => m.SampleSession), { ssr: false });
const WalkAway = dynamic(() => import("./walk-away").then((m) => m.WalkAway), { ssr: false });
const FinePrint = dynamic(() => import("./fine-print").then((m) => m.FinePrint), { ssr: false });
const FinalCta = dynamic(() => import("./final-cta").then((m) => m.FinalCta), { ssr: false });

/** Renders its children once it comes within a screen or so of the viewport. Holds its space until then. */
function Deferred({ minHeight, children }: { minHeight: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <div ref={ref} style={near ? undefined : { minHeight }}>
      {near && children}
    </div>
  );
}

export function BelowFold() {
  return (
    <>
      <Deferred minHeight={900}>
        <MeetThePanel />
      </Deferred>
      <Deferred minHeight={1200}>
        <SampleSession />
      </Deferred>
      <Deferred minHeight={1000}>
        <WalkAway />
      </Deferred>
      <Deferred minHeight={400}>
        <FinePrint />
      </Deferred>
      <Deferred minHeight={400}>
        <FinalCta />
      </Deferred>
    </>
  );
}
