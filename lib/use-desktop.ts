"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 64rem)";

/** True at the lg breakpoint and up. False on the server and the first client render. */
export function useDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
