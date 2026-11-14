"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { copy } from "@/lib/copy";

/** The owner's own row: take it off the board (it stays shareable by link). */
export function HideButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/sessions/${id}/visibility`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ listed: false }),
        }).catch(() => null);
        setBusy(false);
        if (res?.ok) router.refresh();
        else toast.error(copy.errors.network);
      }}
      className="ml-3 text-text-muted underline underline-offset-4 hover:text-text disabled:opacity-50"
    >
      {copy.board.hide}
    </button>
  );
}
