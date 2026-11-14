import type { Metadata } from "next";
import { DemoLoader } from "@/components/demo/demo-loader";
import { copy } from "@/lib/copy";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ title: copy.seo.demo.title, description: copy.seo.demo.description, path: "/demo" });

/** The sample session. No API calls: it never touches a limit or the database. */
export default function DemoPage() {
  return <DemoLoader />;
}
