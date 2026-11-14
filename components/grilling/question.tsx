"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ReactionCue } from "@/components/judge-portrait";
import { DeltaChip, chipLayoutId } from "@/components/odds-widget";
import type { Send } from "@/components/session/session-shell";
import { copy } from "@/lib/copy";
import { reactionForDelta } from "@/lib/judge-sprites";
import { EASE } from "@/lib/motion";
import type { OddsEvent } from "@/lib/odds";
import { MAX_ANSWER_LENGTH, type QuestionView } from "@/lib/session";
import { useDesktop } from "@/lib/use-desktop";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { AnswerField } from "./answer-field";
import { Bench } from "./bench";
import { LifelineButton, LifelineLine } from "./lifeline";
import { QuestionText } from "./question-text";
import { Timer } from "./timer";
import { useAnswerClock } from "./use-answer-clock";
import { useAutoAnswer, useDoze, useKeepInView, useReaction } from "./use-question-effects";
import { useVoiceAnswer } from "./use-voice-answer";
import { VoiceSlot } from "./voice-button";

const noop = () => () => {};

export type Phase = "asking" | "waiting" | "reacting";

export function Question({
  q,
  index,
  send,
  eventCount,
  chipEvent,
  lifelineAvailable,
  onSettled,
  onDone,
  autoAnswer,
  frozen = false,
}: {
  q: QuestionView;
  index: number;
  send: Send;
  /** How many events the view has; once this answer is scored, its event is the last. */
  eventCount: number;
  chipEvent: OddsEvent | undefined;
  lifelineAvailable: boolean;
  /** The chip has flown: show the new odds. */
  onSettled: () => void;
  /** The reaction has been read: on to the next question. */
  onDone: () => void;
  /** The sample session: this answer types itself in once the question has landed. */
  autoAnswer?: string;
  /** A still: the answer already typed, the clock stopped, nothing sent. */
  frozen?: boolean;
}) {
  const reduce = useReducedMotion();
  const desktop = useDesktop();
  const [text, setText] = useState(frozen ? (autoAnswer ?? "") : "");
  const [phase, setPhase] = useState<Phase>("asking");
  const sent = useRef(false);
  // Typing before hydration would be lost, so the field opens once React is running.
  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The asking judge talks while the question types out, and stops as the last word lands.
  const [talking, setTalking] = useState(true);
  const typed = useCallback(() => setTalking(false), []);
  const { dozing, wake } = useDoze(phase === "asking", text);

  const stopped = phase !== "asking" || frozen;
  const clock = useAnswerClock(q, !stopped, frozen);

  const submit = (answer: string) => {
    if (sent.current) return;
    sent.current = true;
    wake();
    clock.stop();
    setPhase("waiting");
    send({ action: "answer", question: index, text: answer }).then(({ ok }) => {
      if (ok) return setPhase("reacting");
      sent.current = false;
      clock.resume();
      setPhase("asking");
    });
  };
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  // Spoken words land in the box as they're heard, editable like typing.
  const voice = useVoiceAnswer({
    text: () => textRef.current,
    onText: (t) => setText(t.slice(0, MAX_ANSWER_LENGTH)),
    desktop,
  });
  // Once the answer is in (or the buzzer went), the mic stops listening.
  const { abort: stopListening } = voice;
  useEffect(() => {
    if (phase !== "asking") stopListening();
  }, [phase, stopListening]);

  // When the clock runs out, whatever is in the box goes in, half-heard words included.
  const expired = clock.left === 0 && !stopped;
  useEffect(() => {
    if (expired) submitRef.current(textRef.current);
  }, [expired]);

  // A reload mid-reaction lands here with the answer already scored: skip straight on.
  const scored = q.answer?.score != null;
  useEffect(() => {
    if (scored && phase === "asking") {
      onSettled();
      onDone();
    }
  }, [scored, phase, onSettled, onDone]);

  const chipHere = useReaction(phase === "reacting", reduce, onSettled, onDone);

  useEffect(() => {
    if (!autoAnswer) inputRef.current?.focus({ preventScroll: true });
  }, [autoAnswer]);

  useAutoAnswer({
    autoAnswer,
    frozen,
    asking: phase === "asking",
    talking,
    reduce,
    setText,
    submit: (t) => submitRef.current(t),
  });
  const keepInView = useKeepInView(inputRef, formRef, reduce);

  const judge = copy.judges[q.judge];
  const a = q.answer;
  const reaction = phase === "reacting" && a?.score != null && a.reason;
  // The two listening react to the score once it's in.
  const kind = phase === "reacting" && chipEvent ? reactionForDelta(chipEvent.delta) : null;
  const cue: ReactionCue | null = kind ? { kind, key: index } : null;
  const live = !autoAnswer && !frozen;

  return (
    <motion.div
      layout="position"
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-12"
    >
      <Bench asker={q.judge} talking={talking} cue={cue} dozing={dozing && phase === "asking"} />
      <div className="min-w-0">
        {/* The odds widget sits top right: the question's first lines wrap around it. */}
        <div aria-hidden className="float-right hidden h-[132px] w-[340px] lg:block" />
        <p className="flex items-center gap-2.5 font-mono text-[13px]">
          <span aria-hidden className="size-2 rounded-full bg-loss" />
          {judge.name}
          {q.followUp && (
            <span className="label-mono uppercase">{copy.acts.grilling.followUp}</span>
          )}
        </p>
        <h1 className="mt-5 max-w-[1120px] text-[36px] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance lg:mt-6 lg:text-question">
          <QuestionText text={q.text} caught={q.caught} onTyped={typed} />
        </h1>

        <AnimatePresence mode="wait" initial={false}>
          {reaction ? (
            <motion.div
              key="reaction"
              className="clear-both mt-10 min-h-[160px] lg:mt-14"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduce ? 0.2 : 0.3, ease: EASE }}
            >
              <p className="label-mono uppercase">{judge.name}</p>
              <p className="mt-3 max-w-[900px] text-[24px] leading-tight font-bold tracking-[-0.02em] text-balance lg:text-[34px]">
                {reaction}
              </p>
              <div className="mt-5 h-[30px]">
                {chipHere && chipEvent && (
                  <DeltaChip
                    event={chipEvent}
                    layoutId={chipLayoutId(eventCount)}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  />
                )}
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              ref={formRef}
              className="clear-both mt-10 flex scroll-mb-4 flex-col-reverse gap-6 lg:mt-14 lg:flex-row lg:items-end lg:gap-12"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              onSubmit={(e) => {
                e.preventDefault();
                submit(text);
              }}
            >
              <AnswerField
                index={index}
                text={text}
                onText={(t) => {
                  wake();
                  setText(t);
                  voice.rebase(t);
                }}
                asking={phase === "asking"}
                waitingFor={phase === "waiting" ? judge.name : null}
                readOnly={!ready || !!autoAnswer}
                inputRef={inputRef}
                onSubmit={() => submit(text)}
                onFocus={() => setTimeout(keepInView, 300)}
                voice={
                  live ? (
                    <VoiceSlot voice={voice} disabled={phase !== "asking"} desktop={desktop} />
                  ) : null
                }
              />
              <div className="flex flex-col items-end gap-3">
                <Timer
                  left={clock.left}
                  readLeft={clock.readLeft}
                  windowMs={clock.windowMs}
                  stopped={stopped}
                />
                {live && q.lifeline && <LifelineLine />}
                {live && lifelineAvailable && !q.lifeline && phase === "asking" && (
                  <LifelineButton
                    disabled={clock.left === 0}
                    onUse={() => void send({ action: "lifeline", question: index })}
                  />
                )}
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
