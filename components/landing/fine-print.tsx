import Link from "next/link";
import { copy } from "@/lib/copy";

/** Three short answers. */
export function FinePrint() {
  const f = copy.landing.finePrint;
  const items = [{ ...f.reads, link: null }, { ...f.stores }, { ...f.cost, link: null }];
  return (
    <section aria-labelledby="fine-heading" className="page-x py-20 lg:py-28">
      <h2
        id="fine-heading"
        className="text-[36px] leading-none font-black tracking-[-0.04em] lg:text-act"
      >
        {f.heading}
      </h2>
      <dl className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 border-t border-border pt-10 lg:mt-14 lg:grid-cols-3 lg:gap-14">
        {items.map((it) => (
          <div key={it.q}>
            <dt className="text-[20px] leading-tight font-bold">{it.q}</dt>
            <dd className="mt-3 text-[17px] leading-snug text-text-muted">
              {it.a}
              {it.link && (
                <>
                  {" "}
                  <Link href="/privacy" className="text-text underline underline-offset-4">
                    {it.link}
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
