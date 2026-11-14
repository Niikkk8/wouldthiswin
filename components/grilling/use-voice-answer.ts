"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { copy } from "@/lib/copy";
import { recognitionCtor, useDictation, type Unavailable } from "./use-dictation";
import { useVoicePref } from "./use-voice-pref";

const V = copy.acts.grilling.voice;
const noop = () => () => {};

/**
 * The voice half of an answer: the browser writes down what's said, straight into the answer
 * box, where it stays editable until the buzzer. It arrives as text, so the server treats it
 * exactly like typing. Where the browser can't do it, the mic is hidden; where the mic is
 * refused, typing it is, and that choice is remembered.
 */
export function useVoiceAnswer({
  text,
  onText,
  desktop,
}: {
  text: () => string;
  onText: (text: string) => void;
  desktop: boolean;
}) {
  const [pref, setPref] = useVoicePref();
  const supported = useSyncExternalStore(
    noop,
    () => recognitionCtor() !== null,
    () => false,
  );
  const [reason, setReason] = useState<Unavailable | null>(null);
  const meter = useRef<(level: number) => void>(() => {});

  const unavailable = useCallback(
    (why: Unavailable) => {
      setReason(why);
      setPref("off");
    },
    [setPref],
  );
  const dictation = useDictation({
    onText,
    onLevel: (level) => meter.current(level),
    onUnavailable: unavailable,
    onLost: () => toast.error(V.lost),
    meter: desktop,
  });

  return {
    enabled: pref === "on" && supported,
    note:
      supported && pref === "off"
        ? reason === "denied"
          ? V.denied
          : reason
            ? V.unsupported
            : V.off
        : null,
    state: dictation.state,
    since: dictation.since,
    metered: dictation.metered,
    /** The button's meter: called with the input level (0 to 1) every frame, styles only. */
    setMeter: (draw: (level: number) => void) => {
      meter.current = draw;
    },
    start: () => dictation.start(text()),
    stop: dictation.stop,
    abort: dictation.abort,
    /** The box was edited: dictation carries on from the edited text. */
    rebase: dictation.rebase,
    turnOn: () => {
      setReason(null);
      setPref("on");
    },
  };
}

export type VoiceAnswer = ReturnType<typeof useVoiceAnswer>;
