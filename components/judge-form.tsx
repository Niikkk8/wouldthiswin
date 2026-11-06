"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { parseRepoUrl } from "@/lib/repo-url";

type ErrorKey = keyof typeof copy.errors;
const PITCH_MAX = 280;
const LINE_MS = 2400;

function errorMessage(key: unknown): string {
  return typeof key === "string" && key in copy.errors
    ? copy.errors[key as ErrorKey]
    : copy.errors.judgeFailed;
}

/** A loop of marker scribble, drawn over and over while the judge reads the repo. */
function Scribble() {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 120 28"
      className="absolute inset-x-4 top-1/2 h-7 -translate-y-1/2"
      aria-hidden="true"
    >
      <motion.path
        d="M 4 18 C 14 4, 20 4, 22 14 S 30 26, 38 12 S 50 2, 54 14 S 64 26, 72 12 S 84 2, 88 14 S 98 26, 106 12 S 114 6, 116 12"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0, pathOffset: 0 }}
        animate={reduce ? undefined : { pathLength: [0, 1, 1], pathOffset: [0, 0, 1] }}
        transition={{
          duration: 1.6,
          ease: "easeInOut",
          repeat: Infinity,
          times: [0, 0.55, 1],
        }}
      />
    </svg>
  );
}

const isTyping = (el: Element | null) =>
  !!el &&
  (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);

export function JudgeForm({
  compact = false,
  shortcut = false,
}: {
  compact?: boolean;
  /** Listen for "/" anywhere on the page and jump to this form's repo field. */
  shortcut?: boolean;
}) {
  const router = useRouter();
  const repoInput = useRef<HTMLInputElement>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoFocused, setRepoFocused] = useState(false);
  const [repoTouched, setRepoTouched] = useState(false);
  const [demoUrl, setDemoUrl] = useState("");
  const [pitch, setPitch] = useState("");
  const [pitchFocused, setPitchFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) {
        return;
      }
      e.preventDefault();
      repoInput.current?.focus({ preventScroll: true });
      repoInput.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const parsed = parseRepoUrl(repoUrl);
  const showInvalid = repoTouched && !repoFocused && repoUrl.trim() !== "" && !parsed;

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setLine((i) => (i + 1) % copy.loading.length), LINE_MS);
    return () => clearInterval(t);
  }, [pending]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLine(0);
    setPending(true);
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          demoUrl: demoUrl.trim() || null,
          pitch: pitch.trim() || null,
        }),
      });
      const data: { id?: string; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        router.push(`/r/${data.id}`);
        return; // stay in the pending state until the result page takes over
      }
      setError(errorMessage(data.error));
    } catch {
      setError(errorMessage(null));
    }
    setPending(false);
  }

  const idBase = compact ? "cta" : "hero";
  const field =
    "w-full rounded-[7px] border-2 border-ink bg-white px-3.5 py-3 text-ink placeholder:text-graphite focus:outline-none focus-visible:outline-none disabled:opacity-60 sm:px-4";

  return (
    <div className="grain grain-soft relative -rotate-[0.6deg] rounded-[3px] bg-white px-4 pb-6 pt-7 shadow-[0_1px_1px_rgb(0_0_0/0.12),0_4px_8px_-4px_rgb(0_0_0/0.2)] sm:px-7 sm:pb-7 sm:pt-9">
      <span className="tape -top-3 left-6 -rotate-[5deg]" aria-hidden="true" />
      <span className="tape -top-3 right-8 rotate-[4deg]" aria-hidden="true" />
      <form onSubmit={onSubmit} className="space-y-3" aria-busy={pending}>
        <div>
          <Field>
            <input
              ref={repoInput}
              className={`${field} sm:text-lg ${shortcut ? "md:pr-12" : ""}`}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              required
              aria-label={copy.home.repoLabel}
              aria-describedby={`${idBase}-repo-status`}
              aria-invalid={showInvalid || undefined}
              aria-keyshortcuts={shortcut ? "/" : undefined}
              placeholder={copy.home.placeholder}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onFocus={() => setRepoFocused(true)}
              onBlur={() => {
                setRepoFocused(false);
                setRepoTouched(true);
              }}
              disabled={pending}
            />
            {shortcut && !repoUrl && !repoFocused && (
              <kbd
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-[5px] border-[1.5px] border-graphite/50 px-1.5 font-sans text-xs font-semibold text-graphite md:block"
                title={copy.home.shortcutHint}
                aria-hidden="true"
              >
                /
              </kbd>
            )}
          </Field>
          <p
            id={`${idBase}-repo-status`}
            className={`mt-3 min-h-5 text-sm ${showInvalid ? "text-marker-red" : "text-graphite"}`}
            aria-live="polite"
          >
            {parsed ? (
              <>
                <span aria-hidden="true">✓ </span>
                {copy.home.repoRecognised}{" "}
                <span className="font-semibold text-ink">
                  {parsed.owner} / {parsed.repo}
                </span>
              </>
            ) : showInvalid ? (
              copy.errors.invalidUrl
            ) : null}
          </p>
        </div>
        {!compact && (
          <>
            <Field>
              <input
                className={field}
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                aria-label={copy.home.demoPlaceholder}
                placeholder={copy.home.demoPlaceholder}
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field>
              <textarea
                className={`${field} block min-h-24 resize-y pb-7 leading-snug`}
                maxLength={PITCH_MAX}
                aria-label={copy.home.pitchPlaceholder}
                placeholder={copy.home.pitchPlaceholder}
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                onFocus={() => setPitchFocused(true)}
                onBlur={() => setPitchFocused(false)}
                disabled={pending}
              />
              <span
                className={`pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums text-graphite ${pitchFocused || pitch ? "" : "invisible"}`}
                aria-hidden="true"
              >
                {pitch.length}/{PITCH_MAX}
              </span>
            </Field>
          </>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-5">
          <button
            type="submit"
            disabled={pending}
            data-pressed={pending}
            className="chunky shrink-0 whitespace-nowrap px-7 py-3.5 text-lg font-bold disabled:cursor-wait"
          >
            <span className={pending ? "invisible" : undefined}>{copy.home.button}</span>
            {pending && <Scribble />}
          </button>
          <p className="min-h-10 text-sm leading-snug text-graphite sm:min-h-0" aria-live="polite">
            {pending ? copy.loading[line] : copy.home.underButton}
          </p>
        </div>

        {error && (
          <p role="alert" className="border-l-[3px] border-marker-red pl-3 font-medium">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

/** Wraps a field so a marker underline can draw in beneath it on focus. */
function Field({ children }: { children: React.ReactNode }) {
  return (
    <div className="field relative">
      {children}
      <svg
        viewBox="0 0 300 8"
        preserveAspectRatio="none"
        className="field-line pointer-events-none absolute -bottom-2 left-1 h-2 w-[calc(100%-0.5rem)]"
        aria-hidden="true"
      >
        <path
          d="M 2 5 C 60 2, 140 7, 220 4 S 290 3, 298 5"
          fill="none"
          stroke="#2d5be3"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
