import { copy } from "@/lib/copy";

/**
 * The same header on every screen. During a session it shows the repo and the act,
 * and the wordmark isn't a link: no navigation away mid-session.
 * On mobile the repo drops to a second line.
 */
export function SiteHeader({ repo, status }: { repo?: string; status?: string }) {
  return (
    <header className="page-x grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] lg:py-7">
      <p className="text-[17px] font-extrabold tracking-[-0.03em]">{copy.brand}</p>
      <p className="label-mono col-span-2 row-start-2 truncate empty:hidden sm:col-span-1 sm:row-start-1 sm:col-start-2 sm:text-center">
        {repo}
      </p>
      <p className="label-mono text-right text-[12px] whitespace-nowrap sm:text-label">{status}</p>
    </header>
  );
}
