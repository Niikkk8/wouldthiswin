import { cn } from "cn";
import { copy, fill } from "@/lib/copy";

const G = copy.acts.grilling;

/**
 * "Question 2 of 3", with one segment per question: answered ones filled, the current one
 * half. Follow-ups share their question's number, so the count never grows mid-grilling.
 */
export function GrillingProgress({
  number,
  total,
  followUp = false,
  done = number - 1,
  className,
}: {
  /** The question on screen, from 1. 0 before the first one. */
  number: number;
  total: number;
  followUp?: boolean;
  /** How many questions are behind them. */
  done?: number;
  className?: string;
}) {
  const label =
    number > 0 ? fill(followUp ? G.progressFollowUp : G.progress, { i: number, total }) : null;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ol aria-hidden className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={cn(
              "h-1.5 w-8 rounded-full",
              i < done ? "bg-text" : i === number - 1 ? "bg-text/45" : "bg-border-strong",
            )}
          />
        ))}
      </ol>
      {label && <p className="label-mono uppercase">{label}</p>}
    </div>
  );
}
