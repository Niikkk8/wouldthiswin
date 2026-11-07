"use client";

import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/site-header";

/** The sample session runs entirely in the browser, from the moment it opens. */
export const DemoLoader = dynamic(() => import("./demo-session").then((m) => m.DemoSession), {
  ssr: false,
  loading: () => <SiteHeader />,
});
