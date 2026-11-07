"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { JudgePortrait, type ReactionCue } from "@/components/judge-portrait";
import { DeltaChip, chipLayoutId, signed } from "@/components/odds-widget";
import { copy, fill } from "@/lib/copy";
import { reactionForDelta } from "@/lib/judge-sprites";
import { EASE } from "@/lib/motion";
import type { OddsEvent } from "@/lib/odds";
import {
  ANSWER_WINDOW_MS,
  JUDGES,
  MAX_ANSWER_LENGTH,
  type Judge,
  type QuestionView,
  type SessionView,
} from "@/lib/session";
import type { Send } from "./session-shell";
import { ActFooter } from "./act-parts";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const noop = () => () => {};

const WORD_MS = 60;
/** The judge's reaction stays up this long before the next question. */
const REACTION_MS = 2000;
/** How long the chip sits by the reaction before it flies to the widget. */
const CHIP_HOLD_MS = 700;
/** The Tired Judge nods off after this long without a keystroke. */
const DOZE_MS = 10_000;

const answerId = (i: number) => `answer-${i}`;

/** Earlier answers, each collapsed to one faded line. The one just given flies in from the field. */
function Transcript({ questions }: { questions: QuestionView[] }) {
  const lines = questions.filter((q) => q.answer);
  if (!lines.length) return null;
  return (
    <ol className="grid gap-1.5 pt-6 text-[15px] leading-snug lg:max-w-[calc(100%-360px)] lg:pt-4 lg:text-[16px]">
      {lines.map((q, i) => {
        const a = q.answer!;
        return (
          <li key={i} className="flex min-w-0 items-baseline gap-3 text-text-subtle" title={q.text}>
            <span className="label-mono shrink-0 uppercase">{copy.judges[q.judge].name}</span>
            <motion.span layoutId={answerId(i)} className="block min-w-0 truncate text-text-muted/80">
              {a.silent ? copy.acts.grilling.silence : a.text}
            </motion.span>
            {a.score !== null && (
              <span
                className={cn(
                  "shrink-0 font-mono text-[13px]",
                  a.score > 0 ? "text-gain" : a.score < 0 ? "text-loss" : "text-text-subtle",
                )}
              >
                {signed(a.score)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The question, word by word at 60ms a word. The caught phrase comes in last, in red, and
 * its underline draws in after it.
 */
function QuestionText({ text, caught }: { text: string; caught: string | null }) {
  const reduce = useReducedMotion();
  const at = caught ? text.indexOf(caught) : -1;
  const parts =
    caught && at >= 0
      ? [
          { text: text.slice(0, at), caught: false },
          { text: caught, caught: true },
          { text: text.slice(at + caught.length), caught: false },
        ]
      : [{ text, caught: false }];

  if (reduce) {
    return (
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {parts.map((p, i) =>
          p.caught ? (
            <span key={i} className="text-loss underline decoration-2 underline-offset-[0.14em]">
              {p.text}
            </span>
          ) : (
            p.text
          ),
        )}
      </motion.span>
    );
  }

  // Plain words go in reading order; the caught words wait until all of them are in, then
  // their underline draws.
  type Token = { text: string; caught: boolean; delay: number; underline: number; bridge: boolean };
  const raw = parts.flatMap((p) => words(p.text).map((w) => ({ text: w, caught: p.caught })));
  const isWord = (t?: { text: string }) => !!t && !/^\s+$/.test(t.text);
  const plainCount = raw.filter((t) => isWord(t) && !t.caught).length;
  const caughtCount = raw.filter((t) => isWord(t) && t.caught).length;
  const caughtStart = (plainCount + 2) * WORD_MS;
  const lineStart = caughtStart + caughtCount * WORD_MS + 120;
  let plain = 0;
  let late = 0;
  const tokens: (Token | string)[] = raw.map((t, i) => {
    if (!isWord(t)) return t.text;
    const k = t.caught ? late++ : plain++;
    return {
      ...t,
      delay: t.caught ? caughtStart + k * WORD_MS : k * WORD_MS,
      underline: lineStart + k * 180,
      // Bridge the space to the next caught word so the underline reads as one line.
      bridge: t.caught && !isWord(raw[i + 1]) && !!raw[i + 2]?.caught,
    };
  });
  // Tokens with no space between them ("calls" + ",") stay on one line together.
  const groups: (Token[] | string)[] = [];
  for (const t of tokens) {
    if (typeof t === "string") groups.push(t);
    else if (Array.isArray(groups.at(-1))) (groups.at(-1) as Token[]).push(t);
    else groups.push([t]);
  }

  return (
    <>
      {groups.map((g, gi) =>
        typeof g === "string" ? (
          g
        ) : (
          <span key={gi} className="whitespace-nowrap">
            {g.map((t, ti) => (
              <motion.span
                key={ti}
                // A token wider than the line (a long file name) may break inside itself.
                className={cn("relative inline-block max-w-full whitespace-normal [overflow-wrap:anywhere]", t.caught && "text-loss")}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: t.delay / 1000 }}
              >
                {t.text}
                {t.caught && (
                  <motion.span
                    aria-hidden
                    className={cn(
                      "absolute -bottom-[0.04em] left-0 h-[0.06em] min-h-[2px] origin-left bg-loss",
                      t.bridge ? "-right-[0.28em]" : "right-0",
                    )}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.18, ease: "linear", delay: t.underline / 1000 }}
                  />
                )}
              </motion.span>
            ))}
          </span>
        ),
      )}
    </>
  );
}

const words = (s: string) => s.split(/(\s+)/).filter(Boolean);

/** How long QuestionText takes to put the whole question on screen. */
function typingMs(text: string, caught: string | null): number {
  const count = (s: string) => words(s).filter((w) => !/^\s+$/.test(w)).length;
  const at = caught ? text.indexOf(caught) : -1;
  if (!caught || at < 0) return count(text) * WORD_MS + 300;
  const plain = count(text.slice(0, at)) + count(text.slice(at + caught.length));
  return (plain + 2 + count(caught)) * WORD_MS + 300;
}

/**
 * The panel beside the question: the judge asking, large, talking while the question types
 * out; the other two small, reacting to the score. On a phone everyone is 128px and the
 * two listening sit in narrower windows.
 */
function Bench({
  asker,
  talking,
  cue,
  dozing,
}: {
  asker: Judge;
  talking: boolean;
  cue: ReactionCue | null;
  dozing: boolean;
}) {
  const others = JUDGES.filter((j) => j !== asker);
  return (
    <div className="flex items-end gap-2 lg:flex-col lg:items-start">
      <div className="overflow-hidden rounded-card border border-border">
        <JudgePortrait judge={asker} size={128} talking={talking} dozing={dozing} label={false} className="lg:hidden" />
        <JudgePortrait judge={asker} size={256} talking={talking} dozing={dozing} label={false} className="hidden lg:block" />
      </div>
      <div className="flex gap-2">
        {others.map((j) => (
          <div key={j} className="w-[92px] overflow-hidden rounded-card border border-border lg:w-auto">
            <JudgePortrait judge={j} reaction={cue} dozing={dozing} className="-mx-[19px] lg:mx-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Timer({ left, stopped }: { left: number; stopped: boolean }) {
  const reduce = useReducedMotion();
  const secs = Math.ceil(left / 1000);
  const urgent = secs <= 10;
  const pulse = urgent && !stopped && !reduce && secs > 0;
  // The bar runs on its own linear animation from where the clock is to zero.
  const [start] = useState(() => ({ fraction: left / ANSWER_WINDOW_MS, ms: left }));

  return (
    <div className="w-full lg:w-[212px]">
      <motion.p
        key={pulse ? secs : "steady"}
        aria-hidden
        className={cn(
          "origin-right text-right font-mono text-[56px] leading-none tabular-nums transition-colors duration-200 lg:text-[88px]",
          urgent ? "text-loss" : "text-text",
        )}
        initial={pulse ? { scale: 1.08, opacity: 0.7 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        0:{String(secs).padStart(2, "0")}
      </motion.p>
      <div className="mt-3 h-[3px] w-full overflow-hidden bg-border-strong">
        <motion.div
          className={cn("h-full origin-left", urgent ? "bg-loss" : "bg-text")}
          initial={{ scaleX: start.fraction }}
          animate={{ scaleX: stopped ? left / ANSWER_WINDOW_MS : 0 }}
          transition={stopped ? { duration: 0 } : { duration: start.ms / 1000, ease: "linear" }}
        />
      </div>
      <p className="sr-only" aria-live="assertive">
        {urgent && !stopped && secs > 0 ? copy.acts.grilling.tenSeconds : ""}
      </p>
    </div>
  );
}

type Phase = "asking" | "waiting" | "reacting";

function Question({
  q,
  index,
  send,
  eventCount,
  chipEvent,
  onSettled,
  onDone,
}: {
  q: QuestionView;
  index: number;
  send: Send;
  /** How many events the view has; once this answer is scored, its event is the last. */
  eventCount: number;
  chipEvent: OddsEvent | undefined;
  /** The chip has flown: show the new odds. */
  onSettled: () => void;
  /** The reaction has been read: on to the next question. */
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const [deadline] = useState(() => Date.now() + (q.remainingMs ?? 0));
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("asking");
  const [chipHere, setChipHere] = useState(true);
  const sent = useRef(false);
  // Typing before hydration would be lost, so the field opens once React is running.
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The asking judge talks while the question types out.
  const [talking, setTalking] = useState(!reduce);
  useEffect(() => {
    const t = setTimeout(() => setTalking(false), reduce ? 0 : typingMs(q.text, q.caught));
    return () => clearTimeout(t);
  }, [reduce, q.text, q.caught]);

  // Ten seconds without a keystroke and the Tired Judge dozes off, until the next one.
  const [dozing, setDozing] = useState(false);
  useEffect(() => {
    if (phase !== "asking") return;
    const t = setTimeout(() => setDozing(true), DOZE_MS);
    return () => clearTimeout(t);
  }, [phase, text]);

  const stopped = phase !== "asking";
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const left = Math.max(0, deadline - (stoppedAt ?? now));

  useEffect(() => {
    if (stopped) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [stopped]);

  const submit = (answer: string) => {
    if (sent.current) return;
    sent.current = true;
    setDozing(false);
    setStoppedAt(Date.now());
    setPhase("waiting");
    send({ action: "answer", question: index, text: answer }).then(({ ok }) => {
      if (ok) return setPhase("reacting");
      sent.current = false;
      setStoppedAt(null);
      setPhase("asking");
    });
  };

  // When the clock runs out, whatever is typed goes in. The server allows a short grace period.
  const expired = left === 0 && !stopped;
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    if (expired) submit(textRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  // A reload mid-reaction lands here with the answer already scored: skip straight on.
  const scored = q.answer?.score != null;
  useEffect(() => {
    if (scored && phase === "asking") {
      onSettled();
      onDone();
    }
  }, [scored, phase, onSettled, onDone]);

  // The reaction: the chip sits by it, flies to the widget, then the next question comes.
  useEffect(() => {
    if (phase !== "reacting") return;
    const fly = setTimeout(
      () => {
        setChipHere(false);
        onSettled();
      },
      reduce ? 0 : CHIP_HOLD_MS,
    );
    const next = setTimeout(onDone, REACTION_MS + (reduce ? 0 : CHIP_HOLD_MS));
    return () => {
      clearTimeout(fly);
      clearTimeout(next);
    };
  }, [phase, reduce, onSettled, onDone]);

  useEffect(() => inputRef.current?.focus({ preventScroll: true }), []);

  // Keep the timer and field in view above a phone keyboard. The keyboard resizes the
  // viewport (resizes-content, or the visual viewport on iOS) after focus, so follow that.
  const keepInView = useCallback(() => {
    if (document.activeElement !== inputRef.current) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    formRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [reduce]);
  useEffect(() => {
    const vv = window.visualViewport;
    window.addEventListener("resize", keepInView);
    vv?.addEventListener("resize", keepInView);
    return () => {
      window.removeEventListener("resize", keepInView);
      vv?.removeEventListener("resize", keepInView);
    };
  }, [keepInView]);

  const judge = copy.judges[q.judge];
  const a = q.answer;
  const reaction = phase === "reacting" && a?.score != null && a.reason;
  const near = text.length >= MAX_ANSWER_LENGTH - 30;
  // The two listening react to the score once it's in.
  const kind = phase === "reacting" && chipEvent ? reactionForDelta(chipEvent.delta) : null;
  const cue: ReactionCue | null = kind ? { kind, key: index } : null;

  return (
    <motion.div
      layout="position"
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-12"
    >
      <Bench asker={q.judge} talking={talking} cue={cue} dozing={dozing && phase === "asking"} />
      <div className="min-w-0">
        <p className="flex items-center gap-2.5 font-mono text-[13px]">
          <span aria-hidden className="size-2 rounded-full bg-loss" />
          {judge.name}
        </p>
        <h1 className="mt-5 max-w-[1120px] text-[36px] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance lg:mt-6 lg:text-question">
          <QuestionText text={q.text} caught={q.caught} />
        </h1>

        <AnimatePresence mode="wait" initial={false}>
          {reaction ? (
            <motion.div
              key="reaction"
              className="mt-10 min-h-[160px] lg:mt-14"
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
              className="mt-10 flex scroll-mb-4 flex-col-reverse gap-6 lg:mt-14 lg:flex-row lg:items-end lg:gap-12"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              onSubmit={(e) => {
                e.preventDefault();
                submit(text);
              }}
            >
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <label htmlFor="answer" className="label-mono">
                    {copy.acts.grilling.answerLabel}
                  </label>
                  <p
                    id="answer-count"
                    className={cn("label-mono tabular-nums", near && "text-unclear")}
                    aria-label={fill(copy.acts.grilling.counterLabel, { n: text.length, max: MAX_ANSWER_LENGTH })}
                  >
                    {fill(copy.acts.grilling.counter, { n: text.length, max: MAX_ANSWER_LENGTH })}
                  </p>
                </div>
                {phase === "asking" ? (
                  <textarea
                    id="answer"
                    ref={inputRef}
                    rows={1}
                    value={text}
                    onChange={(e) => {
                      setDozing(false);
                      setText(e.target.value.replace(/[\r\n]+/g, " ").slice(0, MAX_ANSWER_LENGTH));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        submit(text);
                      }
                    }}
                    onFocus={() => setTimeout(keepInView, 300)}
                    maxLength={MAX_ANSWER_LENGTH}
                    readOnly={!ready}
                    aria-describedby="answer-count answer-hint"
                    autoComplete="off"
                    enterKeyHint="send"
                    className="mt-4 field-sizing-content w-full resize-none border-b border-border-strong bg-transparent pb-4 font-mono text-[18px] text-text outline-offset-4 read-only:text-text-muted lg:text-[20px]"
                  />
                ) : (
                  // The submitted answer: it collapses into the transcript once it's scored.
                  <div className="mt-4 border-b border-border-strong pb-4">
                    <motion.p layoutId={answerId(index)} className="font-mono text-[18px] text-text-muted lg:text-[20px]">
                      {text.trim() || copy.acts.grilling.silence}
                    </motion.p>
                  </div>
                )}
                <p id="answer-hint" className="label-mono mt-3" role="status">
                  {phase === "waiting" ? fill(copy.acts.grilling.thinking, { judge: judge.name }) : copy.acts.grilling.hint}
                </p>
              </div>

              <Timer left={left} stopped={stopped} />
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Act 2, the grilling. */
export function GrillingAct({
  view,
  send,
  revealed,
  onReveal,
  pending,
}: {
  view: SessionView;
  send: Send;
  revealed: number;
  onReveal: (n: number) => void;
  pending: boolean;
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
          send={send}
          eventCount={eventCount}
          chipEvent={view.events.at(-1)}
          onSettled={settle}
          onDone={next}
        />
      )}
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
