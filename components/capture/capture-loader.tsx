"use client";

import dynamic from "next/dynamic";

/** Capture runs only in the browser, like the sample session. */
export const CaptureLoader = dynamic(
  () => import("./capture-session").then((m) => m.CaptureSession),
  {
    ssr: false,
  },
);
