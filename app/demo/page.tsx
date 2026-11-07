import type { Metadata } from "next";
import { DemoLoader } from "@/components/demo/demo-loader";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: `${copy.demo.label} · ${copy.meta.name}`,
  description: copy.meta.description,
};

/** The sample session. No API calls: it never touches a limit or the database. */
export default function DemoPage() {
  return <DemoLoader />;
}
