// The sample session's stand-in for the network. It runs the real state machine on the
// fixture, in the browser: no API calls, nothing stored, nothing counted toward any limit.

import { copy } from "../copy";
import type { ScanProgress } from "../scan-progress";
import {
  acceptAnswer,
  advance,
  applyPanel,
  applyScan,
  issueQuestion,
  settleAnswer,
  toView,
  type Result,
  type SessionState,
} from "../session";
import { DEMO_ANSWERS, DEMO_PANEL, DEMO_SCAN } from "./fixture";

/** Mirrors SessionShell's Transport: what the server would have answered. */
export type DemoAction =
  | { action: "scan" }
  | { action: "advance"; from: SessionState["act"] }
  | { action: "show"; question: number }
  | { action: "answer"; question: number; text: string }
  | { action: "deliberate" };

export type TransportResult = { status: number; body: Record<string, unknown> };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The scan as the server streams it, a little faster. */
const SCAN_STEPS: ScanProgress[] = [
  { type: "repo", files: DEMO_SCAN.files.length },
  { type: "claims", claims: DEMO_SCAN.claims.map((c) => c.claim) },
  ...DEMO_SCAN.sources.flatMap((s): ScanProgress[] => [
    { type: "reading", path: s.path },
    { type: "read", path: s.path, ok: true },
  ]),
  { type: "reading", path: "app/layout.tsx" },
  { type: "read", path: "app/layout.tsx", ok: true },
  { type: "checking", claims: DEMO_SCAN.claims.length },
];

export type DemoTimings = { scanStepMs: number; thinkMs: number; deliberateMs: number };
export const DEMO_TIMINGS: DemoTimings = { scanStepMs: 420, thinkMs: 900, deliberateMs: 1400 };

/**
 * A transport over one in-memory session. `onChange` hears every new state, so a page can
 * follow the session without owning it.
 */
export function demoTransport(
  initial: SessionState,
  { timings = DEMO_TIMINGS, onChange }: { timings?: DemoTimings; onChange?: (s: SessionState) => void } = {},
) {
  let state = initial;
  const view = () => toView(state, Date.now());
  const apply = (r: Result): TransportResult => {
    if (!r.ok) return { status: 409, body: { error: "stale", message: copy.errors.stale, view: view() } };
    state = r.session;
    onChange?.(state);
    return { status: 200, body: { view: view() } };
  };

  return async (_id: string, a: DemoAction, onProgress?: (p: ScanProgress) => void): Promise<TransportResult> => {
    switch (a.action) {
      case "scan":
        if (state.claims === null) {
          for (const p of SCAN_STEPS) {
            await wait(timings.scanStepMs);
            onProgress?.(p);
          }
          await wait(timings.scanStepMs);
          return apply(applyScan(state, DEMO_SCAN));
        }
        return { status: 200, body: { view: view() } };
      case "advance":
        return apply(advance(state, a.from));
      case "show":
        return apply(issueQuestion(state, a.question, Date.now()));
      case "answer": {
        const accepted = apply(acceptAnswer(state, a.question, a.text, Date.now()));
        if (accepted.status !== 200) return accepted;
        await wait(timings.thinkMs);
        const scored = DEMO_ANSWERS[a.question];
        return apply(settleAnswer(state, a.question, { score: scored.score, reason: scored.reason }));
      }
      case "deliberate":
        if (state.panel) return { status: 200, body: { view: view() } };
        await wait(timings.deliberateMs);
        return apply(applyPanel(state, DEMO_PANEL));
    }
  };
}
