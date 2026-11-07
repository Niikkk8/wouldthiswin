"use client";

import { useSyncExternalStore } from "react";

// Motion's own useReducedMotion reads the media query before hydration, so a component that
// renders different elements under reduced motion doesn't match the server HTML and React
// throws the tree away (on the landing page that lost the first click). This one renders
// the server's answer (false) during hydration, then switches.

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
