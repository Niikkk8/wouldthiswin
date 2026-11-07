"use client";

import { useState } from "react";
import { SessionShell, type Transport } from "@/components/session/session-shell";
import { demoState } from "@/lib/demo/fixture";
import { demoTransport } from "@/lib/demo/transport";
import { toView } from "@/lib/session";

/** The full sample session: all four acts on fixture data, run in the browser. */
export function DemoSession() {
  const [start] = useState(() => {
    const s = demoState("start");
    return { view: toView(s, Date.now()), transport: demoTransport(s) as Transport };
  });
  return <SessionShell initial={start.view} transport={start.transport} demo />;
}
