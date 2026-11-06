import { copy } from "./copy";
import type { Judgment } from "./judge";

/** The prefilled post text for a result, including the judge's one-liner when there is one. */
export function shareText(result: Pick<Judgment, "verdict" | "overall"> & { oneLiner?: string }) {
  const text = copy.share.template
    .replace("{verdict}", result.verdict)
    .replace("{score}", String(result.overall));
  return result.oneLiner
    ? text.replace("{oneLiner}", result.oneLiner)
    : text.replace(/\. "\{oneLiner\}"$/, "");
}
