import Link from "next/link";
import { InstagramIcon, LinkedInIcon, XIcon } from "@/components/social-icons";
import { copy } from "@/lib/copy";

const ICON = { X: XIcon, Instagram: InstagramIcon, LinkedIn: LinkedInIcon } as const;

/** Outside a session only: no navigation away mid-session. */
export function SiteFooter() {
  const f = copy.footer;
  return (
    <footer className="page-x flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-border py-6">
      <p className="label-mono">
        {f.builtBy}{" "}
        <a href={f.author.url} target="_blank" rel="noopener" className="text-text-muted underline underline-offset-4 hover:text-text">
          {f.author.name}
        </a>
      </p>
      <div className="flex items-center gap-5">
        <ul className="flex items-center gap-1">
          {f.socials.map((s) => {
            const Icon = ICON[s.label as keyof typeof ICON];
            return (
              <li key={s.label}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${f.author.name} on ${s.label}`}
                  className="grid size-9 place-items-center rounded-control text-text-subtle transition-colors hover:text-text"
                >
                  <Icon />
                </a>
              </li>
            );
          })}
        </ul>
        <Link href="/guides" className="label-mono underline underline-offset-4 hover:text-text">
          {f.guides}
        </Link>
        <Link href="/privacy" className="label-mono underline underline-offset-4 hover:text-text">
          {f.privacy}
        </Link>
      </div>
    </footer>
  );
}
