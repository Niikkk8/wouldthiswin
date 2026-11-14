"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  heard,
  joinSpoken,
  recognitionFailure,
  recognitionLang,
  type RecognitionResults,
} from "@/lib/dictation";

/** The parts of the Web Speech API's SpeechRecognition this uses (Chrome still prefixes it). */
export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: RecognitionResults }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Run = {
  rec: Recognition;
  /** Text before this recognition run: the box, plus everything earlier runs settled. */
  base: string;
  /** Results of this run already folded into `base` (after a rebase). */
  from: number;
  seen: number;
  final: string;
  restarts: number[];
  audio?: { stream: MediaStream; ctx: AudioContext; raf: number };
};

export type DictationState = "idle" | "starting" | "listening";
export type Unavailable = "denied" | "unsupported";

/** Chrome ends a continuous run after a pause or a minute; more restarts than this in 2 s is a loop. */
const MAX_QUICK_RESTARTS = 4;

/**
 * Dictation into the answer box. Words stream in as they're heard (interim results), and the
 * run restarts by itself if the browser ends it, until `stop`. Typing mid-dictation is kept:
 * `rebase` makes the edited text the new starting point. `onLevel` drives the meter from a
 * separate mic stream (desktop only: phones can't share the mic with recognition); without it
 * the button shows a listening animation instead.
 */
export function useDictation({
  onText,
  onLevel,
  onUnavailable,
  onLost,
  meter,
}: {
  onText: (text: string) => void;
  onLevel: (level: number) => void;
  onUnavailable: (why: Unavailable) => void;
  onLost: () => void;
  meter: boolean;
}) {
  const [state, setState] = useState<DictationState>("idle");
  const [metered, setMetered] = useState(false);
  const [since, setSince] = useState(0);
  const run = useRef<Run | null>(null);
  const handlers = useRef({ onText, onLevel, onUnavailable, onLost });
  useEffect(() => {
    handlers.current = { onText, onLevel, onUnavailable, onLost };
  });

  const stopMeter = useCallback(() => {
    const a = run.current?.audio;
    if (!a) return;
    run.current!.audio = undefined;
    cancelAnimationFrame(a.raf);
    a.stream.getTracks().forEach((t) => t.stop());
    void a.ctx.close();
    handlers.current.onLevel(0);
    setMetered(false);
  }, []);

  const startMeter = useCallback(async () => {
    if (!meter || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = run.current;
      if (!r) return stream.getTracks().forEach((t) => t.stop());
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        handlers.current.onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        if (r.audio) r.audio.raf = requestAnimationFrame(tick);
      };
      r.audio = { stream, ctx, raf: requestAnimationFrame(tick) };
      setMetered(true);
    } catch {
      // No meter, no problem: the listening animation stands in.
    }
  }, [meter]);

  const end = useCallback(
    (how: "stop" | "abort") => {
      const r = run.current;
      if (!r) return;
      stopMeter();
      run.current = null;
      r.rec.onend = null;
      r.rec.onerror = null;
      if (how === "abort") r.rec.onresult = null;
      try {
        if (how === "abort") r.rec.abort();
        else r.rec.stop();
      } catch {
        // Already ended.
      }
      setState("idle");
    },
    [stopMeter],
  );

  const start = useCallback(
    (box: string) => {
      const Ctor = recognitionCtor();
      if (!Ctor) return handlers.current.onUnavailable("unsupported");
      if (run.current) return;
      const rec = new Ctor();
      rec.lang = recognitionLang(navigator.language);
      rec.continuous = true;
      rec.interimResults = true;
      const r: Run = { rec, base: box, from: 0, seen: 0, final: "", restarts: [] };
      run.current = r;

      rec.onaudiostart = () => {
        setState((cur) => {
          if (cur !== "listening") setSince(Date.now());
          return "listening";
        });
        if (!r.audio) void startMeter();
      };
      rec.onresult = (e) => {
        const { final, interim } = heard(e.results, r.from);
        r.seen = e.results.length;
        r.final = final;
        handlers.current.onText(joinSpoken(r.base, final, interim));
      };
      rec.onerror = (e) => {
        const why = recognitionFailure(e.error);
        if (!why) return;
        end("abort");
        if (why === "lost") handlers.current.onLost();
        else handlers.current.onUnavailable(why);
      };
      // The browser ended the run on its own: keep what it settled and listen again.
      rec.onend = () => {
        if (run.current !== r) return;
        const now = Date.now();
        r.restarts = [...r.restarts.filter((t) => now - t < 2_000), now];
        if (r.restarts.length > MAX_QUICK_RESTARTS) return end("stop");
        r.base = joinSpoken(r.base, r.final);
        r.final = "";
        r.from = 0;
        r.seen = 0;
        try {
          rec.start();
        } catch {
          end("stop");
        }
      };

      setState("starting");
      try {
        rec.start();
      } catch {
        run.current = null;
        setState("idle");
      }
    },
    [end, startMeter],
  );

  /** The box was edited mid-dictation: that's the new starting point, and words heard so far stay as typed. */
  const rebase = useCallback((text: string) => {
    const r = run.current;
    if (!r) return;
    r.base = text;
    r.from = r.seen;
    r.final = "";
  }, []);

  // Leaving the question mid-dictation drops it.
  useEffect(() => () => end("abort"), [end]);

  return {
    state,
    /** When listening began, for the elapsed seconds. */
    since,
    metered,
    start,
    /** Let the last words settle, then stop. */
    stop: useCallback(() => end("stop"), [end]),
    /** Stop at once: the answer is going in as it stands. */
    abort: useCallback(() => end("abort"), [end]),
    rebase,
  };
}
