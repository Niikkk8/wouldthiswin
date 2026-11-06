"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { toast } from "sonner";
import { OddsWidget } from "@/components/odds-widget";
import { SiteHeader } from "@/components/site-header";
import { copy, fill } from "@/lib/copy";
import { EASE } from "@/lib/motion";
import { ACTS, type ActName, type SessionView } from "@/lib/session";
import { DeliberationAct } from "./deliberation-act";
import { GrillingAct } from "./grilling-act";
import { ScanAct } from "./scan-act";
import { ShareAct } from "./share-act";
import { VerdictAct } from "./verdict-act";

export type SessionAction =
  | { action: "advance"; from: ActName }
  | { action: "show"; question: number }
  | { action: "answer"; question: number; text: string };

/** Sends one action to the server. Resolves true if it was applied. */
export type Send = (a: SessionAction) => Promise<boolean>;

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

function headerStatus(view: SessionView): string {
  if (view.act === "share") return copy.header.share;
  if (view.act === "grilling") {
    const answered = view.questions.filter((q) => q.answer).length;
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
  // How many scan events have played. Only the scan plays them in; later acts show all.
  const [revealed, setRevealed] = useState(0);

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
        if (!res.ok) toast.error(body.message ?? copy.errors.network);
        return res.ok;
      } catch {
        toast.error(copy.errors.network);
        return false;
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
  const events = view.act === "scan" ? view.events.slice(0, revealed) : view.events;

  let act: React.ReactNode;
  switch (view.act) {
    case "scan":
      act = (
        <ScanAct
          view={view}
          revealed={revealed}
          onReveal={setRevealed}
          onNext={advance("scan")}
          pending={pending}
        />
      );
      break;
    case "grilling":
      act = <GrillingAct view={view} send={send} pending={pending} />;
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
      <SiteHeader repo={view.repo} status={headerStatus(view)} />
      <main className="page-x relative flex-1 pb-16 lg:pb-20">
        <AnimatePresence initial={false}>
          {ODDS_ACTS.includes(view.act) && <OddsWidget key="odds" events={events} />}
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
