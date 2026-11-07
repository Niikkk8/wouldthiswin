import { z } from "zod";
import { badRequest, fail, failMutation } from "@/lib/api";
import {
  ACTS,
  QUESTION_COUNT,
  acceptAnswer,
  advance,
  applyPanel,
  issueQuestion,
  settleAnswer,
  toView,
  type SessionState,
} from "@/lib/session";
import { runSessionScan } from "@/lib/run-scan";
import { scoreAnswer } from "@/lib/answer-score";
import { addUsage, mutate, ownerHash, type MutateResult } from "@/lib/session-store";
import { standInPanel } from "@/lib/stand-in";

// The scan: GitHub (~5s), demo check in parallel, up to two model calls.
export const maxDuration = 60;

const Question = z.number().int().min(0).max(QUESTION_COUNT - 1);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("scan") }),
  z.object({ action: z.literal("advance"), from: z.enum(ACTS) }),
  z.object({ action: z.literal("show"), question: Question }),
  // Longer answers are cut to MAX_ANSWER_LENGTH (300) by the state machine.
  z.object({ action: z.literal("answer"), question: Question, text: z.string().max(2000) }),
]);

const ok = (s: SessionState) => Response.json({ view: toView(s, Date.now()) });

/**
 * Scores any recorded-but-unscored answers in order, then writes the deliberation once
 * the last one is scored. Safe to call twice: every step checks it hasn't already run.
 */
async function finishPending(id: string, owner: string | null, s: SessionState): Promise<MutateResult> {
  let r: MutateResult = { ok: true, session: s };
  for (let i = 0; i < s.answers.length; i++) {
    if (!r.ok) return r;
    const a = r.session.answers[i];
    if (a.score !== null) continue;
    let scored: { score: number; reason: string } | null = null;
    if (!a.silent) {
      const q = r.session.questions[i];
      const out = await scoreAnswer({
        judge: q.judge,
        question: q.text,
        answer: a.text,
        claims: r.session.claims ?? [],
      });
      await addUsage(id, out.usage);
      scored = out;
    }
    r = await mutate(id, owner, (cur) => settleAnswer(cur, i, scored));
  }
  if (!r.ok) return r;
  const done = r.session.answers.length === r.session.questions.length;
  if (done && r.session.panel === null) {
    r = await mutate(id, owner, (cur) => applyPanel(cur, standInPanel()));
  }
  return r;
}

export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest();
  }

  try {
    const owner = await ownerHash();
    const now = Date.now();
    let r: MutateResult;

    switch (body.action) {
      case "scan": {
        const out = await runSessionScan(id, owner);
        switch (out.kind) {
          case "done":
            return ok(out.session);
          case "pending":
            return Response.json({ pending: true, view: toView(out.session, now) }, { status: 202 });
          case "stale":
            return fail("stale", out.session);
          case "notFound":
            return fail("notFound");
          case "failed":
            // The session is over: the client offers a way back to the start.
            return fail(out.error, undefined, { restart: true });
        }
      }
      case "advance": {
        r = await mutate(id, owner, (s) => advance(s, body.from));
        // A scoring step that failed earlier gets another go before the grilling can end.
        if (!r.ok && r.error === "actIncomplete" && body.from === "grilling" && r.session) {
          const pending = await finishPending(id, owner, r.session);
          if (pending.ok) r = await mutate(id, owner, (s) => advance(s, body.from));
        }
        break;
      }
      case "show":
        r = await mutate(id, owner, (s) => issueQuestion(s, body.question, now));
        break;
      case "answer": {
        r = await mutate(id, owner, (s) => acceptAnswer(s, body.question, body.text, now));
        if (r.ok) r = await finishPending(id, owner, r.session);
        break;
      }
    }

    return r.ok ? ok(r.session) : failMutation(r);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "session.action.error",
        id,
        action: body.action,
        error: err instanceof Error ? err.message : JSON.stringify(err),
      }),
    );
    return fail("judgeFailed");
  }
}
