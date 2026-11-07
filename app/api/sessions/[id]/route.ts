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
import { PanelError, runPanel } from "@/lib/panel";
import {
  addUsage,
  claimPanel,
  loadSession,
  mutate,
  ownerHash,
  releasePanel,
  type MutateResult,
} from "@/lib/session-store";

// The scan: GitHub (~5s), demo check in parallel, up to two model calls.
export const maxDuration = 60;

const Question = z.number().int().min(0).max(QUESTION_COUNT - 1);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("scan") }),
  z.object({ action: z.literal("advance"), from: z.enum(ACTS) }),
  z.object({ action: z.literal("show"), question: Question }),
  // Longer answers are cut to MAX_ANSWER_LENGTH (300) by the state machine.
  z.object({ action: z.literal("answer"), question: Question, text: z.string().max(2000) }),
  z.object({ action: z.literal("deliberate") }),
]);

const ok = (s: SessionState) => Response.json({ view: toView(s, Date.now()) });

/** Scores any recorded-but-unscored answers in order. Safe to call twice: each is scored once. */
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
  return r;
}

type Deliberation =
  | { kind: "done"; session: SessionState }
  | { kind: "pending"; session: SessionState }
  | { kind: "notFound" }
  | { kind: "failed"; session: SessionState };

/**
 * Act 3: one deliberation call per session. A second request while it runs gets
 * "pending" and asks again, like the scan.
 */
async function deliberate(id: string, owner: string | null): Promise<Deliberation> {
  const loaded = await loadSession(id, owner);
  if (!loaded) return { kind: "notFound" };
  const s = loaded.session;
  if (s.act !== "deliberation" || s.panel !== null) return { kind: "done", session: s };
  if (!(await claimPanel(id))) return { kind: "pending", session: s };
  try {
    const out = await runPanel(s);
    await addUsage(id, out.usage);
    console.log(
      JSON.stringify({
        event: "panel.done",
        id,
        dropped: out.dropped,
        input_tokens: out.usage.inputTokens,
        output_tokens: out.usage.outputTokens,
      }),
    );
    const r = await mutate(id, owner, (cur) => applyPanel(cur, out.panel));
    if (r.ok) return { kind: "done", session: r.session };
    return r.session ? { kind: "done", session: r.session } : { kind: "notFound" };
  } catch (err) {
    if (err instanceof PanelError) await addUsage(id, err.usage);
    console.error(JSON.stringify({ event: "panel.failed", id, error: err instanceof Error ? err.message : String(err) }));
    await releasePanel(id);
    return { kind: "failed", session: s };
  }
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
      case "deliberate": {
        const out = await deliberate(id, owner);
        switch (out.kind) {
          case "done":
            return ok(out.session);
          case "pending":
            return Response.json({ pending: true, view: toView(out.session, now) }, { status: 202 });
          case "notFound":
            return fail("notFound");
          case "failed":
            return fail("judgeFailed", out.session);
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
