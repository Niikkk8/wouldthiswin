"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { copy } from "@/lib/copy";
import { ANSWER_WINDOW_MS, MAX_ANSWER_LENGTH, type QuestionView, type SessionView } from "@/lib/session";
import type { Send } from "./session-shell";
import { ActFooter } from "./act-parts";

const noop = () => () => {};
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Transcript({ questions }: { questions: QuestionView[] }) {
  const answered = questions.filter((q) => q.answer);
  if (!answered.length) return null;
  return (
    <ol className="grid gap-3 pt-6 text-[17px] lg:max-w-[calc(100%-360px)] lg:pt-4">
      {answered.map((q, i) => (
        <li key={i} className="grid gap-3">
          <p className="text-text-subtle">
            <span className="label-mono mr-2 uppercase">{copy.judges[q.judge].name}</span>
            {q.text}
          </p>
          <p className="text-text-muted">
            <span className="label-mono mr-2 uppercase">{copy.acts.grilling.you}</span>
            {q.answer!.silent ? copy.acts.grilling.silence : q.answer!.text}
            {q.answer!.score !== null && (
              <span
                className={cn(
                  "ml-3 font-mono text-[14px]",
                  q.answer!.score > 0 ? "text-gain" : q.answer!.score < 0 ? "text-loss" : "",
                )}
              >
                {signed(q.answer!.score)}
              </span>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** The question, with the caught phrase in red. */
function QuestionText({ text, caught }: { text: string; caught: string | null }) {
  const at = caught ? text.indexOf(caught) : -1;
  if (!caught || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-loss">{caught}</span>
      {text.slice(at + caught.length)}
    </>
  );
}

function Question({ q, index, send }: { q: QuestionView; index: number; send: Send }) {
  const reduce = useReducedMotion();
  const [deadline] = useState(() => Date.now() + (q.remainingMs ?? 0));
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState("");
  const sent = useRef(false);
  const [waiting, setWaiting] = useState(false);
  // Typing before hydration would be lost, so the field opens once React is running.
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const urgent = secs <= 10;

  const submit = (answer: string) => {
    if (sent.current) return;
    sent.current = true;
    setWaiting(true);
    send({ action: "answer", question: index, text: answer }).then(({ ok }) => {
      if (!ok) {
        sent.current = false;
        setWaiting(false);
      }
    });
  };

  // When the clock runs out, whatever is typed goes in. The server allows a short grace period.
  const expired = left === 0;
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    if (expired) submit(textRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  useEffect(() => inputRef.current?.focus(), []);

  const judge = copy.judges[q.judge];
  return (
    <div className="mt-14 lg:mt-16">
      <p className="flex items-center gap-2.5 font-mono text-[13px]">
        <span aria-hidden className="size-2 rounded-full bg-loss" />
        {judge.name}
      </p>
      <h1 className="mt-6 max-w-[1120px] text-[36px] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance lg:text-question">
        <QuestionText text={q.text} caught={q.caught} />
      </h1>

      <form
        className="mt-14 flex flex-col-reverse gap-8 lg:mt-20 lg:flex-row lg:items-end lg:gap-12"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <div className="flex-1">
          <label htmlFor="answer" className="label-mono">
            {copy.acts.grilling.answerLabel}
          </label>
          <input
            id="answer"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_ANSWER_LENGTH}
            readOnly={waiting || !ready}
            aria-busy={waiting}
            autoComplete="off"
            enterKeyHint="send"
            className="mt-4 w-full border-b read-only:text-text-muted border-border-strong bg-transparent pb-4 font-mono text-[18px] text-text outline-offset-4 placeholder:text-text-subtle lg:text-[20px]"
          />
          <p className="label-mono mt-3">{copy.acts.grilling.hint}</p>
        </div>

        <div className="w-full lg:w-[212px]">
          <motion.p
            key={urgent && !reduce ? secs : "calm"}
            aria-hidden
            className={cn(
              "text-right font-mono text-[56px] leading-none tabular-nums lg:text-[88px]",
              urgent ? "text-loss" : "text-text",
            )}
            initial={urgent && !reduce ? { opacity: 0.55 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            0:{String(secs).padStart(2, "0")}
          </motion.p>
          <div className="mt-3 h-[3px] w-full bg-border-strong">
            <div
              className={cn(
                "h-full origin-left transition-transform duration-200 ease-linear",
                urgent ? "bg-loss" : "bg-text",
              )}
              style={{ transform: `scaleX(${left / ANSWER_WINDOW_MS})` }}
            />
          </div>
          <p className="sr-only" aria-live="assertive">
            {urgent && !expired ? copy.acts.grilling.tenSeconds : ""}
          </p>
        </div>
      </form>
    </div>
  );
}

/** Act 2, the grilling. Placeholder motion: the word-by-word reveal comes next. */
export function GrillingAct({ view, send, pending }: { view: SessionView; send: Send; pending: boolean }) {
  const answered = view.questions.filter((q) => q.answer).length;
  const done = answered === view.questionCount;
  const current = view.questions[answered];
  const asked = useRef(-1);

  // Ask the server to start the clock on the next question.
  useEffect(() => {
    if (done || current || asked.current === answered) return;
    asked.current = answered;
    send({ action: "show", question: answered }).then(({ ok }) => {
      if (!ok) asked.current = -1;
    });
  }, [done, current, answered, send]);

  return (
    <>
      <Transcript questions={view.questions} />
      {current && <Question key={answered} q={current} index={answered} send={send} />}
      {done && (
        <ActFooter
          label={copy.acts.grilling.next}
          onClick={() => send({ action: "advance", from: "grilling" })}
          disabled={pending}
        />
      )}
    </>
  );
}
