// Starting a session from the browser: the landing form, a re-judge and an event page all
// go through here, so a cap is always met with the same "judges are asleep" screen.

import { z } from "zod";
import { copy } from "./copy";

const Asleep = z.object({
  resetAt: z.string().datetime(),
  lastReview: z.object({ id: z.string(), repo: z.string() }).nullable(),
});
export type AsleepInfo = z.infer<typeof Asleep> & {
  reason: "rateLimited" | "dailyCap" | "spendCap";
};

const Body = z.object({
  id: z.string().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  asleep: Asleep.optional(),
});

export type StartRequest = {
  repoUrl: string;
  demoUrl?: string;
  previousId?: string;
  eventSlug?: string;
  devpostUrl?: string;
  submissionText?: string;
  windowStart?: string;
  windowEnd?: string;
  tracks?: string[];
};

export type StartResult =
  | { kind: "started"; id: string }
  | { kind: "asleep"; asleep: AsleepInfo }
  | { kind: "error"; message: string };

const CAPS = new Set(["rateLimited", "dailyCap", "spendCap"]);

export async function startSession(req: StartRequest): Promise<StartResult> {
  let res: Response;
  try {
    res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    return { kind: "error", message: copy.errors.network };
  }
  const parsed = Body.safeParse(await res.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};
  if (res.ok && body.id) return { kind: "started", id: body.id };
  if (body.asleep && body.error && CAPS.has(body.error)) {
    return {
      kind: "asleep",
      asleep: { ...body.asleep, reason: body.error as AsleepInfo["reason"] },
    };
  }
  return { kind: "error", message: body.message ?? copy.errors.judgeFailed };
}
