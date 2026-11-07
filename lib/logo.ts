// public/logo.png as a data URI, for the generated icons and share cards (next/og can't
// fetch from the site while it builds).

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The mark's own size; scale by width and keep this ratio. */
export const LOGO_RATIO = 66 / 91;

let cached: Promise<string> | null = null;

export function logoDataUri(): Promise<string> {
  cached ??= readFile(join(process.cwd(), "public", "logo.png")).then(
    (buf) => `data:image/png;base64,${buf.toString("base64")}`,
  );
  return cached;
}
