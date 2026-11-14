"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useReducer, useState } from "react";
import { toast } from "sonner";
import { OddsWidget } from "@/components/odds-widget";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { ANSWER_MAX } from "@/lib/odds";
import type { ScanProgress } from "@/lib/scan-progress";
import { ACTS, type ActName, type SessionView } from "@/lib/session";
import { ActFrame } from "./action-bar";
import { DeliberationAct } from "./deliberation-act";
import { GrillingAct } from "./grilling-act";
import { ScanAct } from "./scan-act";
import { ShareAct } from "./share-act";
import { VerdictAct } from "./verdict-act";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { DEMO_ANSWERS } from "@/lib/demo/fixture";

const DEMO_ANSWER_TEXTS = DEMO_ANSWERS.map((a) => a.text);

export type SessionAction =
  | { action: "scan" }
  | { action: "advance"; from: ActName }
  | { action: "show"; question: number }
  | { action: "answer"; question: number; text: string }
  | { action: "deliberate" }
  | { action: "lifeline"; question: number }
  | { action: "recording"; question: number };

export type SendResult = {
  ok: boolean;
  /** Another request is already running this (the scan): ask again shortly. */
  pending?: boolean;
  /** The session can't continue; offer a way back to the start. */
  restart?: boolean;
  message?: string;
};

/**
 * Sends one action to the server and mirrors the view it returns. With `onProgress`, the
 * response is streamed and each real progress event is passed on as it arrives (the scan).
 */
export type Send = (
  a: SessionAction,
  opts?: { onProgress?: (p: ScanProgress) => void },
) => Promise<SendResult>;

/** Reads an NDJSON body: progress lines go to `onProgress`; returns the final result line. */
async function readStream(
  res: Response,
  onProgress: (p: ScanProgress) => void,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: { status: number; body: Record<string, unknown> } | null = null;
  const take = (line: string) => {
    if (!line.trim()) return;
    const msg = JSON.parse(line);
    if (msg.type === "progress") onProgress(msg.event);
    else if (msg.type === "result") result = { status: msg.status, body: msg.body ?? {} };
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      take(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  take(buf);
  // A stream cut off before its result line is a lost connection.
  if (!result) throw new Error("stream ended without a result");
  return result;
}

/** How an action reaches the server. The sample session swaps in a local one. */
export type Transport = (
  id: string,
  a: SessionAction,
  onProgress?: (p: ScanProgress) => void,
) => Promise<{ status: number; body: Record<string, unknown> }>;

/** The real one: a POST, streamed as NDJSON when progress is wanted. */
const fetchTransport: Transport = async (id, a, onProgress) => {
  const res = await fetch(`/api/sessions/${id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(onProgress ? { accept: "application/x-ndjson" } : {}),
    },
    body: JSON.stringify(a),
  });
  const isStream =
    !!onProgress && !!res.body && (res.headers.get("content-type") ?? "").includes("ndjson");
  return isStream
    ? readStream(res, onProgress!)
    : { status: res.status, body: await res.json().catch(() => ({})) };
};

// The reducer only mirrors the server: every change to the session arrives as a new view.
type State = { view: SessionView; pending: boolean };
type Action = { type: "sync"; view: SessionView } | { type: "pending"; pending: boolean };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "sync":
      return { ...state, view: a.view };
    case "pending":
      return { ...state, pending: a.pending };
  }
}

const ODDS_ACTS: readonly ActName[] = ["scan", "grilling", "deliberation"];

function headerStatus(view: SessionView, revealed: number): string {
  if (view.act === "share") return copy.header.share;
  if (view.act === "grilling") {
    // An answer counts once its odds change has landed, so the header doesn't run ahead
    // of the judge's reaction.
    const held = Math.max(0, view.events.length - revealed);
    const answered = view.questions.filter((q) => q.answer).length - held;
    return fill(copy.header.question, {
      i: Math.min(answered + 1, view.questionCount),
      total: view.questionCount,
    });
  }
  return fill(copy.header.act, { n: ACTS.indexOf(view.act) + 1 });
}

export function SessionShell({
  initial,
  transport = fetchTransport,
  demo = false,
  answers = demo ? DEMO_ANSWER_TEXTS : undefined,
  drawCards = false,
}: {
  initial: SessionView;
  transport?: Transport;
  /** The sample session: fixture data, answers typed for the team, no real links at the end. */
  demo?: boolean;
  /** Answers typed in for the team, by question. A gap leaves that question to the person (or voice). */
  answers?: readonly (string | undefined)[];
  /** Dev capture only: the share cards are drawn in the page from the fixture. */
  drawCards?: boolean;
}) {
  const reduce = useReducedMotion();
  const [{ view, pending }, dispatch] = useReducer(reducer, { view: initial, pending: false });
  // How many events the widget shows. The scan plays its events in, and act 2 holds each
  // answer's event back until its chip has flown to the widget. Later acts show all.
  const [revealed, setRevealed] = useState(initial.act === "scan" ? 0 : initial.events.length);
  // The scan is running: the widget sits at 50% with a slow pulse until playback starts.
  const [waiting, setWaiting] = useState(initial.act === "scan" && initial.claims === null);

  const send = useCallback<Send>(
    async (a, opts) => {
      dispatch({ type: "pending", pending: true });
      try {
        const { status, body } = await transport(initial.id, a, opts?.onProgress);
        const ok = status >= 200 && status < 300;
        if (body.view) dispatch({ type: "sync", view: body.view as SessionView });
        if (status === 202) return { ok: false, pending: true };
        const message = (body.message as string | undefined) ?? copy.errors.network;
        // A dead session is shown in place, not as a toast.
        if (!ok && !body.restart) toast.error(message);
        return { ok, restart: body.restart === true, message };
      } catch {
        toast.error(copy.errors.network);
        return { ok: false, message: copy.errors.network };
      } finally {
        dispatch({ type: "pending", pending: false });
      }
    },
    [initial.id, transport],
  );

  const advance = (from: ActName) => () => send({ action: "advance", from });
  const events =
    view.act === "scan" || view.act === "grilling" ? view.events.slice(0, revealed) : view.events;
  const asking = view.act === "grilling" && view.questions.some((q) => !q.answer);

  let act: React.ReactNode;
  switch (view.act) {
    case "scan":
      act = (
        <ScanAct
          view={view}
          send={send}
          revealed={revealed}
          onReveal={setRevealed}
          onNext={advance("scan")}
          onWaiting={setWaiting}
          pending={pending}
        />
      );
      break;
    case "grilling":
      act = (
        <GrillingAct
          view={view}
          send={send}
          revealed={revealed}
          onReveal={setRevealed}
          pending={pending}
          autoAnswers={answers}
        />
      );
      break;
    case "deliberation":
      act = (
        <DeliberationAct
          view={view}
          send={send}
          onNext={advance("deliberation")}
          pending={pending}
        />
      );
      break;
    case "verdict":
      act = <VerdictAct view={view} onNext={advance("verdict")} pending={pending} demo={demo} />;
      break;
    case "share":
      act = <ShareAct view={view} demo={demo} drawCards={drawCards} />;
      break;
  }

  return (
    <ActFrame
      resetKey={view.act}
      step={
        view.act === "share"
          ? copy.header.share
          : fill(copy.header.act, { n: ACTS.indexOf(view.act) + 1 })
      }
      header={
        <SiteHeader
          repo={demo ? fill(copy.demo.header, { repo: view.repo }) : view.repo}
          status={headerStatus(view, revealed)}
        />
      }
    >
      <AnimatePresence initial={false}>
        {ODDS_ACTS.includes(view.act) && (
          <OddsWidget
            key="odds"
            events={events}
            travel={view.act === "grilling"}
            waiting={view.act === "scan" && waiting}
            note={asking ? fill(copy.acts.grilling.riding, { max: ANSWER_MAX }) : undefined}
            // The act's own column now: its right edge is the content's.
            className="lg:right-0!"
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view.act}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0.2 : 0.25, ease: EASE } }}
          transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE }}
        >
          {act}
        </motion.div>
      </AnimatePresence>
    </ActFrame>
  );
}
