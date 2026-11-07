import Link from "next/link";
import { copy } from "@/lib/copy";

/** Outside a session only: no navigation away mid-session. */
export function SiteFooter() {
  return (
    <footer className="page-x flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-border py-6">
      <p className="label-mono">{copy.footer.note}</p>
      <Link href="/privacy" className="label-mono underline underline-offset-4 hover:text-text">
        {copy.footer.privacy}
      </Link>
    </footer>
  );
}
