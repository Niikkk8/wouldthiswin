"use client";

import { motion } from "motion/react";
import { cn } from "cn";
import { copy, fill } from "@/lib/copy";
import { MAX_ANSWER_LENGTH } from "@/lib/session";
import { answerId } from "./transcript";

const G = copy.acts.grilling;

/**
 * The answer box: a growing textarea while the clock runs, then the submitted answer, which
 * collapses into the transcript once scored (shared layoutId). A transcript from a voice
 * answer lands here and stays editable until the buzzer.
 */
export function AnswerField({
  index,
  text,
  onText,
  asking,
  waitingFor,
  readOnly,
  inputRef,
  onSubmit,
  onFocus,
  voice,
}: {
  index: number;
  text: string;
  onText: (t: string) => void;
  asking: boolean;
  /** The judge writing the score down, while it's being scored. */
  waitingFor: string | null;
  readOnly: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: () => void;
  onFocus: () => void;
  voice: React.ReactNode;
}) {
  const near = text.length >= MAX_ANSWER_LENGTH - 50;
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="answer" className="label-mono">
          {G.answerLabel}
        </label>
        <p
          id="answer-count"
          className={cn("label-mono tabular-nums", near && "text-unclear")}
          aria-label={fill(G.counterLabel, { n: text.length, max: MAX_ANSWER_LENGTH })}
        >
          {fill(G.counter, { n: text.length, max: MAX_ANSWER_LENGTH })}
        </p>
      </div>
      {asking ? (
        <textarea
          id="answer"
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => onText(e.target.value.replace(/[\r\n]+/g, " ").slice(0, MAX_ANSWER_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSubmit();
            }
          }}
          onFocus={onFocus}
          maxLength={MAX_ANSWER_LENGTH}
          readOnly={readOnly}
          aria-describedby="answer-count answer-hint"
          autoComplete="off"
          enterKeyHint="send"
          className="mt-4 field-sizing-content max-h-[40vh] w-full resize-none border-b border-border-strong bg-transparent pb-4 font-mono text-[18px] text-text outline-offset-4 read-only:text-text-muted lg:text-[20px]"
        />
      ) : (
        <div className="mt-4 border-b border-border-strong pb-4">
          <motion.p layoutId={answerId(index)} className="font-mono text-[18px] text-text-muted lg:text-[20px]">
            {text.trim() || G.silence}
          </motion.p>
        </div>
      )}
      {asking && voice && <div className="mt-4">{voice}</div>}
      <p id="answer-hint" className="label-mono mt-3" role="status">
        {waitingFor ? fill(G.thinking, { judge: waitingFor }) : G.hint}
      </p>
    </div>
  );
}
