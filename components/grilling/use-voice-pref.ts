"use client";

import { useCallback, useSyncExternalStore } from "react";

// Remembers "type, don't talk" after the mic was denied or isn't there, so the next question
// doesn't ask again. Per browser only: it's a convenience, never state the server needs.
const KEY = "wtw-voice";
const listeners = new Set<() => void>();

function read(): "on" | "off" {
  try {
    return window.localStorage.getItem(KEY) === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** "on" until the visitor's mic fails (or they turn it off); null before hydration. */
export function useVoicePref(): ["on" | "off" | null, (v: "on" | "off") => void] {
  const value = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((v: "on" | "off") => {
    try {
      if (v === "off") window.localStorage.setItem(KEY, "off");
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage blocked (private mode): the choice lasts for this page only.
    }
    listeners.forEach((l) => l());
  }, []);
  return [value, set];
}
