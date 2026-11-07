"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { toast } from "sonner";
import { OddsWidget } from "@/components/odds-widget";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { ANSWER_MAX } from "@/lib/odds";
import { ACTS, type ActName, type SessionView } from "@/lib/session";
import { DeliberationAct } from "./deliberation-act";
import { GrillingAct } from "./grilling-act";
import { ScanAct } from "./scan-act";
import { ShareAct } from "./share-act";
import { VerdictAct } from "./verdict-act";

export type SessionAction =
  | { action: "scan" }
  | { action: "advance"; from: ActName }
  | { action: "show"; question: number }
  | { action: "answer"; question: number; text: string };

export type SendResult = {
  ok: boolean;
  /** Another request is already running this (the scan): ask again shortly. */
  pending?: boolean;
  /** The session can't continue; offer a way back to the start. */
  restart?: boolean;
  message?: string;
};

/** Sends one action to the server and mirrors the view it returns. */
export type Send = (a: SessionAction) => Promise<SendResult>;

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

export function SessionShell({ initial }: { initial: SessionView }) {
  const reduce = useReducedMotion();
  const [{ view, pending }, dispatch] = useReducer(reducer, { view: initial, pending: false });
  // How many events the widget shows. The scan plays its events in, and act 2 holds each
  // answer's event back until its chip has flown to the widget. Later acts show all.
  const [revealed, setRevealed] = useState(initial.act === "scan" ? 0 : initial.events.length);

  const send = useCallback<Send>(
    async (a) => {
      dispatch({ type: "pending", pending: true });
      try {
        const res = await fetch(`/api/sessions/${initial.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(a),
        });
        const body = await res.json().catch(() => ({}));
        if (body.view) dispatch({ type: "sync", view: body.view });
        if (res.status === 202) return { ok: false, pending: true };
        const message: string = body.message ?? copy.errors.network;
        // A dead session is shown in place, not as a toast.
        if (!res.ok && !body.restart) toast.error(message);
        return { ok: res.ok, restart: body.restart === true, message };
      } catch {
        toast.error(copy.errors.network);
        return { ok: false, message: copy.errors.network };
      } finally {
        dispatch({ type: "pending", pending: false });
      }
    },
    [initial.id],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view.act]);

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
          pending={pending}
        />
      );
      break;
    case "grilling":
      act = (
        <GrillingAct view={view} send={send} revealed={revealed} onReveal={setRevealed} pending={pending} />
      );
      break;
    case "deliberation":
      act = <DeliberationAct view={view} onNext={advance("deliberation")} pending={pending} />;
      break;
    case "verdict":
      act = <VerdictAct view={view} onNext={advance("verdict")} pending={pending} />;
      break;
    case "share":
      act = <ShareAct view={view} />;
      break;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader repo={view.repo} status={headerStatus(view, revealed)} />
      <main className="page-x relative flex-1 pb-16 lg:pb-20">
        <AnimatePresence initial={false}>
          {ODDS_ACTS.includes(view.act) && (
            <OddsWidget
              key="odds"
              events={events}
              travel={view.act === "grilling"}
              note={asking ? fill(copy.acts.grilling.riding, { max: ANSWER_MAX }) : undefined}
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
      </main>
    </div>
  );
}
