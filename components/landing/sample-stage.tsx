"use client";

import { useCallback, useState } from "react";
import { OddsWidget } from "@/components/odds-widget";
import { ReviewView } from "@/components/review/review-view";
import { DeliberationAct } from "@/components/session/deliberation-act";
import { GrillingAct } from "@/components/session/grilling-act";
import { ScanAct } from "@/components/session/scan-act";
import type { Send } from "@/components/session/session-shell";
import { DEMO_ANSWERS, DEMO_ID, demoState, type DemoAt } from "@/lib/demo/fixture";
import { demoTransport, type DemoAction } from "@/lib/demo/transport";
import { reviewOf } from "@/lib/review";
import { toView } from "@/lib/session";

// The real acts, playing the sample session. Loaded only when a stage is about to be seen:
// it's the heaviest code on the landing page.

const ANSWERS = DEMO_ANSWERS.map((a) => a.text);
const noop = () => {};

export type StageKind = "scan" | "grilling" | "answered" | "deliberation" | "review";

/** One run of the sample session from a fixed point, on the local transport. */
function useDemoRun(at: DemoAt) {
  const [initial] = useState(() => demoState(at));
  const [view, setView] = useState(() => toView(initial, Date.now()));
  const [transport] = useState(() =>
    demoTransport(initial, { onChange: (s) => setView(toView(s, Date.now())) }),
  );
  const send = useCallback<Send>(
    async (a, opts) => {
      const r = await transport(DEMO_ID, a as DemoAction, opts?.onProgress);
      return { ok: r.status < 300 };
    },
    [transport],
  );
  return { view, send };
}

/** The odds, pinned in the stage's corner on desktop and a plain bar above each block on a phone. */
const ODDS_CLASS =
  "lg:top-6! lg:right-10! max-lg:static! max-lg:mx-0! max-lg:rounded-card max-lg:border";

function ScanStage({ still }: { still: boolean }) {
  const { view, send } = useDemoRun("scanned");
  const [revealed, setRevealed] = useState(still ? view.events.length : 0);
  return (
    <>
      <OddsWidget events={view.events.slice(0, revealed)} className={ODDS_CLASS} />
      <ScanAct
        view={view}
        send={send}
        revealed={revealed}
        onReveal={setRevealed}
        onNext={noop}
        onWaiting={noop}
        pending={false}
      />
    </>
  );
}

function GrillingStage({ still, at }: { still: boolean; at: "grilling" | "answered" }) {
  const { view, send } = useDemoRun(still && at === "grilling" ? "asking" : at);
  const [revealed, setRevealed] = useState(view.events.length);
  return (
    <>
      <OddsWidget events={view.events.slice(0, revealed)} travel className={ODDS_CLASS} />
      <GrillingAct
        view={view}
        send={send}
        revealed={revealed}
        onReveal={setRevealed}
        pending={false}
        autoAnswers={ANSWERS}
        frozen={still}
      />
    </>
  );
}

function DeliberationStage({ still }: { still: boolean }) {
  const { view, send } = useDemoRun(still ? "deliberated" : "deliberation");
  return (
    <>
      <OddsWidget events={view.events} className={ODDS_CLASS} />
      <DeliberationAct view={view} send={send} onNext={noop} pending={false} />
    </>
  );
}

function ReviewStage() {
  const [review] = useState(() => reviewOf(demoState("verdict"))!);
  return <ReviewView review={review} />;
}

export function Stage({ kind, still = false }: { kind: StageKind; still?: boolean }) {
  switch (kind) {
    case "scan":
      return <ScanStage still={still} />;
    case "grilling":
      return <GrillingStage still={still} at="grilling" />;
    case "answered":
      return <GrillingStage still at="answered" />;
    case "deliberation":
      return <DeliberationStage still={still} />;
    case "review":
      return <ReviewStage />;
  }
}
