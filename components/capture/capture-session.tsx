"use client";

import { useEffect, useState } from "react";
import { SessionShell, type Transport } from "@/components/session/session-shell";
import { CAPTURE_START, type CaptureAct } from "@/lib/demo/capture-acts";
import { demoState } from "@/lib/demo/fixture";
import { PULSEBOARD } from "@/lib/demo/pulseboard";
import { PULSEBOARD_ROUND2 } from "@/lib/demo/pulseboard-round2";
import { demoTransport } from "@/lib/demo/transport";
import { toView } from "@/lib/session";
import { installScriptedSpeech } from "./scripted-speech";

// The first answer is spoken (the voice button, with the script's words heard live); the rest
// are typed in.
const TYPED = [undefined, ...PULSEBOARD.answers.slice(1).map((a) => a.text)];
installScriptedSpeech(PULSEBOARD.answers[0].text);

/** One act of the PulseBoard session, live, for the demo videos. */
export function CaptureSession({ act }: { act: CaptureAct }) {
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
