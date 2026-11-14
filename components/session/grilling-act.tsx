"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Question } from "@/components/grilling/question";
import { Transcript } from "@/components/grilling/transcript";
import { copy } from "@/lib/copy";
import type { SessionView } from "@/lib/session";
import type { Send } from "./session-shell";
import { ActionBar } from "./action-bar";

/** Act 2, the grilling. */
export function GrillingAct({
  view,
  send,
  revealed,
  onReveal,
  pending,
  autoAnswers,
  frozen,
}: {
  view: SessionView;
  send: Send;
  revealed: number;
  onReveal: (n: number) => void;
  pending: boolean;
  /** The sample session: the team's answers, typed in for them. */
  autoAnswers?: readonly (string | undefined)[];
  /** A still of the sample session. */
  frozen?: boolean;
}) {
  const answered = view.questions.filter((q) => q.answer).length;
  // The question on screen. It stays put while its reaction plays, after the server has
  // already moved on, and only then does the next one get asked for.
  const [onScreen, setOnScreen] = useState(answered);
  const done = onScreen >= view.questionCount;
  const current = view.questions[onScreen];
  const asked = useRef(-1);
  const eventCount = view.events.length;

  // Ask the server to start the clock on the next question.
  useEffect(() => {
    if (done || current || asked.current === onScreen || onScreen !== answered) return;
    asked.current = onScreen;
    send({ action: "show", question: onScreen }).then(({ ok }) => {
      if (!ok) asked.current = -1;
    });
  }, [done, current, onScreen, answered, send]);

  // Anything not held back by a reaction (a reload, a resync) shows straight away.
  const reacting = !!current?.answer;
  useEffect(() => {
    if (!reacting && revealed < eventCount) onReveal(eventCount);
  }, [reacting, revealed, eventCount, onReveal]);

  const settle = useCallback(() => onReveal(eventCount), [onReveal, eventCount]);
  const next = useCallback(() => setOnScreen((i) => i + 1), []);

  return (
    <>
      <Transcript questions={view.questions} />
      {current && (
        <Question
          key={onScreen}
          q={current}
          index={onScreen}
          sessionId={view.id}
          send={send}
          lifelineAvailable={view.lifelineAvailable}
          eventCount={eventCount}
          chipEvent={view.events.at(-1)}
          onSettled={settle}
          onDone={next}
          autoAnswer={autoAnswers?.[onScreen]}
          frozen={frozen}
        />
      )}
      <ActionBar
        label={copy.acts.grilling.next}
        status={copy.acts.grilling.busy}
        ready={done}
        pending={pending}
        onNext={() => send({ action: "advance", from: "grilling" })}
      />
    </>
  );
}
