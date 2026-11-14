"use client";

import { useEffect, useState } from "react";
import { SessionShell, type Transport } from "@/components/session/session-shell";
import { CAPTURE_START, type CaptureAct } from "@/lib/demo/capture-acts";
import { demoState } from "@/lib/demo/fixture";
import { PULSEBOARD } from "@/lib/demo/pulseboard";
import { PULSEBOARD_ROUND2 } from "@/lib/demo/pulseboard-round2";
import { demoTransport } from "@/lib/demo/transport";
import { toView } from "@/lib/session";

// The first answer is spoken (the voice button, a real recording); the rest are typed in.
const TYPED = [undefined, ...PULSEBOARD.answers.slice(1).map((a) => a.text)];
const TRANSCRIBE_MS = 900;

/**
 * Stands in for /api/transcribe while a capture runs: the recording is real, the words are
 * the script's. Restores fetch on the way out.
 */
function useScriptedTranscript() {
  useEffect(() => {
    const real = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.endsWith("/api/transcribe")) return real(input, init);
      await new Promise((r) => setTimeout(r, TRANSCRIBE_MS));
      return Response.json({ text: PULSEBOARD.answers[0].text });
    };
    return () => {
      window.fetch = real;
    };
  }, []);
}

/** One act of the PulseBoard session, live, for the demo videos. */
export function CaptureSession({ act }: { act: CaptureAct }) {
  useScriptedTranscript();
  const [start] = useState(() => {
    const fixture = act === "rejudge" ? PULSEBOARD_ROUND2 : PULSEBOARD;
    const s = demoState(CAPTURE_START[act], Date.now(), fixture);
    return {
      view: toView(s, Date.now()),
      transport: demoTransport(s, { fixture }) as Transport,
    };
  });

  useEffect(() => {
    if (act !== "fixes") return;
    const t = setTimeout(
      () => document.getElementById("fix-list")?.scrollIntoView({ block: "start" }),
      300,
    );
    return () => clearTimeout(t);
  }, [act]);

  return <SessionShell initial={start.view} transport={start.transport} answers={TYPED} />;
}
