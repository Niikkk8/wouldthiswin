"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Send } from "@/components/session/session-shell";
import { copy } from "@/lib/copy";
import { recordingType, type RecorderState } from "./use-recorder";
import { useVoicePref } from "./use-voice-pref";

const V = copy.acts.grilling.voice;
const Reply = z.object({ text: z.string().optional(), message: z.string().optional() });
const noop = () => () => {};

/**
 * The voice half of an answer: tells the server a recording started (the upload is judged by
 * that time), sends the audio to be transcribed, and hands the words back. If the buzzer went
 * while recording or uploading, the words go straight in as the answer.
 */
export function useVoiceAnswer({
  sessionId,
  index,
  send,
  onTranscript,
  onLateTranscript,
}: {
  sessionId: string;
  index: number;
  send: Send;
  onTranscript: (text: string) => void;
  onLateTranscript: (answer: string) => void;
}) {
  const [pref, setPref] = useVoicePref();
  const supported = useSyncExternalStore(
    noop,
    () => recordingType() !== null,
    () => false,
  );
  const [reason, setReason] = useState<Extract<RecorderState, "denied" | "unsupported"> | null>(
    null,
  );
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const lateText = useRef<string | null>(null);

  const started = useCallback(() => {
    setRecording(true);
    void send({ action: "recording", question: index });
  }, [send, index]);

  const finish = useCallback(
    (words: string | null) => {
      const late = lateText.current;
      if (late !== null) {
        lateText.current = null;
        onLateTranscript([late.trim(), words ?? ""].filter(Boolean).join(" "));
      } else if (words) {
        onTranscript(words);
      }
    },
    [onLateTranscript, onTranscript],
  );

  const upload = useCallback(
    async (audio: Blob) => {
      setRecording(false);
      setUploading(true);
      const form = new FormData();
      form.append("session", sessionId);
      form.append("question", String(index));
      form.append("audio", audio);
      let words: string | null = null;
      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const body = Reply.safeParse(await res.json().catch(() => ({})));
        const reply = body.success ? body.data : {};
        if (res.ok && reply.text) words = reply.text;
        else toast.error(reply.message ?? copy.errors.voiceUnavailable);
      } catch {
        toast.error(copy.errors.network);
      }
      // Audio is dropped here: only the words are kept, in the answer box.
      setUploading(false);
      finish(words);
    },
    [sessionId, index, finish],
  );

  const unavailable = useCallback(
    (why: Extract<RecorderState, "denied" | "unsupported">) => {
      setRecording(false);
      setReason(why);
      setPref("off");
    },
    [setPref],
  );

  return {
    enabled: pref === "on" && supported,
    note:
      pref === "off"
        ? reason === "denied"
          ? V.denied
          : reason === "unsupported"
            ? V.unsupported
            : V.off
        : null,
    uploading,
    busy: recording || uploading,
    started,
    upload,
    unavailable,
    turnOn: () => {
      setReason(null);
      setPref("on");
    },
    /** The buzzer went mid-recording: whatever was typed waits for the transcript. */
    expire: (typed: string) => {
      lateText.current = typed;
    },
  };
}
