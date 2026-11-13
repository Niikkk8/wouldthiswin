"use client";

import { useEffect, useState } from "react";
import type { QuestionView } from "@/lib/session";

/** A still of the sample session shows this much time left. */
const FROZEN_LEFT_MS = 18_000;

/**
 * The client's copy of the server's clock: when the read grace ends and when the buzzer goes,
 * taken from the view's remaining times (server-computed) on arrival. A lifeline comes back as
 * a new view with a longer window, and the clock follows it.
 */
export function useAnswerClock(q: QuestionView, running: boolean, frozen: boolean) {
  const [marks, setMarks] = useState(() => mark(q));
  const [seenWindow, setSeenWindow] = useState(q.windowMs);
  if (q.windowMs !== seenWindow) {
    setSeenWindow(q.windowMs);
    setMarks(mark(q));
  }
  const [now, setNow] = useState(() => Date.now());
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [running]);

  const at = stoppedAt ?? now;
  return {
    readLeft: frozen ? 0 : Math.max(0, marks.readEnds - at),
    left: frozen ? FROZEN_LEFT_MS : Math.max(0, marks.deadline - Math.max(at, marks.readEnds)),
    windowMs: q.windowMs,
    stop: () => setStoppedAt(Date.now()),
    resume: () => setStoppedAt(null),
  };
}

function mark(q: QuestionView) {
  const t = Date.now();
  const readEnds = t + (q.readMs ?? 0);
  return { readEnds, deadline: readEnds + (q.remainingMs ?? 0) };
}
