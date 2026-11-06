import Link from "next/link";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="mx-auto flex pb-24 max-w-6xl flex-col px-4 pt-24 sm:px-8">
      <p className="max-w-xl text-3xl font-bold leading-tight text-balance">
        {copy.notFoundPage.message}
      </p>
      <Link
        href="/"
        className="mt-8 self-start bg-ink px-6 py-3 font-bold text-white hover:bg-lanyard"
      >
        {copy.notFoundPage.button}
      </Link>
    </div>
  );
}
