import { copy } from "./copy";
import type { MutateResult } from "./session-store";
import { toView, type SessionState } from "./session";

export type ErrorKey = keyof typeof copy.errors;

const STATUS: Record<ErrorKey, number> = {
  invalidUrl: 400,
  invalidDemo: 400,
  notFound: 404,
  emptyRepo: 422,
  emptyReadme: 422,
  rateLimited: 429,
  dailyCap: 429,
  spendCap: 429,
  githubDown: 503,
  judgeFailed: 502,
  swamped: 503,
  githubAuth: 503,
  stale: 409,
  alreadyAnswered: 409,
  nothingNew: 409,
  notReviewed: 409,
  network: 503,
};

/** An error response. Pass the session when there is one, so the client can resync to it. */
export function fail(key: ErrorKey, session?: SessionState, extra?: Record<string, unknown>) {
  return Response.json(
    {
      error: key,
      message: copy.errors[key],
      ...(session ? { view: toView(session, Date.now()) } : {}),
      ...extra,
    },
    { status: STATUS[key] },
  );
}

export const badRequest = () => Response.json({ error: "badRequest" }, { status: 400 });

/** Maps a failed transition to a response. Any out-of-order call is "stale": the client resyncs. */
export function failMutation(r: Extract<MutateResult, { ok: false }>) {
  if (r.error === "notFound") return fail("notFound");
  if (r.error === "alreadyAnswered") return fail("alreadyAnswered", r.session);
  return fail("stale", r.session);
}

export { clientIp, limitKey } from "./client-ip";
