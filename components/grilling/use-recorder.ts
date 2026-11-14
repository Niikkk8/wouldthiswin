"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_MS } from "@/lib/deadline";

export type RecorderState = "idle" | "starting" | "recording" | "denied" | "unsupported";

// Chrome and Firefox record WebM/Opus; Safari records MP4/AAC.
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function recordingType(): string | null {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return null;
  }
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/**
 * One recording at a time from the microphone. `onLevel` gets the input level (0 to 1) every
 * frame while recording; it's for a meter that writes styles directly, so nothing re-renders
 * per frame. The audio stays in memory until `onAudio` has it, then it's dropped.
 */
export function useRecorder({
  onAudio,
  onLevel,
  maxMs = MAX_RECORDING_MS,
}: {
  onAudio: (audio: Blob, type: string) => void;
  onLevel: (level: number) => void;
  maxMs?: number;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const live = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    raf: number;
    cap: number;
  } | null>(null);
  const handlers = useRef({ onAudio, onLevel });
  useEffect(() => {
    handlers.current = { onAudio, onLevel };
  });

  const release = useCallback(() => {
    const l = live.current;
    if (!l) return;
    live.current = null;
    cancelAnimationFrame(l.raf);
    clearTimeout(l.cap);
    l.stream.getTracks().forEach((t) => t.stop());
    void l.ctx.close();
    handlers.current.onLevel(0);
  }, []);

  const stop = useCallback(() => {
    const l = live.current;
    if (l && l.recorder.state !== "inactive") l.recorder.stop();
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (live.current) return true;
    const type = recordingType();
    if (!type) {
      setState("unsupported");
      return false;
    }
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      setState(denied ? "denied" : "unsupported");
      return false;
    }
    const recorder = new MediaRecorder(stream, { mimeType: type });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      release();
      setState("idle");
      if (chunks.length) handlers.current.onAudio(new Blob(chunks, { type }), type);
    };

    // The meter: RMS of the waveform, read once a frame.
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
      if (live.current) live.current.raf = requestAnimationFrame(tick);
    };

    live.current = { recorder, stream, ctx, raf: 0, cap: window.setTimeout(stop, maxMs) };
    recorder.start(1000);
    live.current.raf = requestAnimationFrame(tick);
    setState("recording");
    return true;
  }, [maxMs, release, stop]);

  // Leaving the question mid-recording drops the audio without sending it.
  useEffect(
    () => () => {
      const l = live.current;
      if (!l) return;
      l.recorder.onstop = null;
      if (l.recorder.state !== "inactive") l.recorder.stop();
      release();
    },
    [release],
  );

  return { state, start, stop };
}
