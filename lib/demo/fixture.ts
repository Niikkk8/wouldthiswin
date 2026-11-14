// The sample session: queueless, a hackathon project that puts a clinic's waiting room on
// a QR code. Every number comes from the real odds engine; the fixture only stands in for
// the model's output and the repo. The odds go 50 → 34 (scan) → 39 → 41 → 37 (answers).

import {
  advance,
  applyPanel,
  applyScan,
  acceptAnswer,
  issueQuestion,
  newSession,
  settleAnswer,
} from "../session";
import type { Panel, Scan, SessionState } from "../session";

export const DEMO_ID = "samplerun2";
export const DEMO_REPO = "queueless-team/queueless";

const SMS_SEARCHED = ["server/queue.ts", "server/notify.ts", "package.json"];

const QUEUE_TS = `import { db } from "./db";

export async function joinQueue(clinicId: string, name: string) {
  const position = await db.ticket.count({ where: { clinicId, done: false } });
  const ticket = await db.ticket.create({ data: { clinicId, name, position } });
  await db.$executeRaw\`NOTIFY queue_update, \${clinicId}\`;
  return ticket;
}`;

const NOTIFY_TS = `// Fires when someone is two places from the front.
export function onTurnClose(ticket: { id: string; phone?: string }) {
  // TODO: send the SMS
  console.log("turn close", ticket.id);
}`;

const ESTIMATE_TS = `export function estimateWait(position: number) {
  return position * 6; // minutes, flat for now
}`;

export const DEMO_SCAN: Scan = {
  claims: [
    {
      claim: "Join the line by scanning a QR code",
      status: "backed",
      weight: "core",
      file: "server/queue.ts",
      evidence: "joinQueue creates a ticket and notifies the room",
      label: "QR join works",
      missing: null,
      searched: [],
      quote: "export async function joinQueue(clinicId: string, name: string) {",
      line: 3,
    },
    {
      claim: "SMS alerts when your turn is close",
      status: "unbacked",
      weight: "core",
      file: null,
      evidence: "onTurnClose logs instead of sending",
      label: "SMS claim unbacked",
      missing: "SMS provider",
      searched: SMS_SEARCHED,
    },
    {
      claim: "Live wait-time estimates",
      status: "unclear",
      weight: "core",
      file: "server/estimate.ts",
      evidence: "a flat six minutes a person, not live",
      label: "Wait estimate is a constant",
      missing: null,
      searched: [],
    },
    {
      claim: "Works offline",
      status: "unbacked",
      weight: "minor",
      file: null,
      evidence: "no service worker or offline cache",
      label: "Offline claim unbacked",
      missing: "service worker",
      searched: ["app/layout.tsx", "next.config.js"],
    },
  ],
  questions: [
    {
      judge: "engineer",
      text: "Your README promises SMS alerts when your turn is close. Which file sends one?",
      caught: "SMS alerts",
      kind: "fact",
    },
    {
      judge: "investor",
      text: "Who pays for this: the clinic or the patient?",
      caught: null,
      kind: "decision",
    },
    {
      judge: "tired",
      text: "In one sentence. What is it?",
      caught: "In one sentence.",
      kind: "fact",
    },
  ],
  signals: {
    demo: { status: "loads", url: "https://queueless.vercel.app/" },
    bulkFirstCommit: false,
  },
  files: [
    "README.md",
    "package.json",
    "next.config.js",
    "app/layout.tsx",
    "app/page.tsx",
    "app/join/[clinic]/page.tsx",
    "server/db.ts",
    "server/queue.ts",
    "server/notify.ts",
    "server/estimate.ts",
  ],
  sources: [
    { path: "server/queue.ts", text: QUEUE_TS },
    { path: "server/notify.ts", text: NOTIFY_TS },
    { path: "server/estimate.ts", text: ESTIMATE_TS },
  ],
};

/** What the sample team types, and what the panel scores it. */
export const DEMO_ANSWERS = [
  {
    text: "None yet. The turn-close event fires, but Twilio isn't wired. That's tonight's job.",
    score: 5,
    reason: "Straight answer. Named the gap and the fix.",
  },
  {
    text: "The clinic, per location per month. Two front desks said they'd try it.",
    score: 2,
    reason: "A buyer, at least. Two maybes isn't a market.",
  },
  {
    text: "A Next.js app with Postgres LISTEN/NOTIFY pushing queue updates over websockets.",
    score: -4,
    reason: "you told me how it works. not what it is.",
  },
] as const;

export const DEMO_PANEL: Panel = {
  chat: [
    { judge: "tired", text: "the qr code thing. which one was that again." },
    {
      judge: "engineer",
      text: 'queue.ts is real. notify.ts logs "turn close" and stops. The SMS is a TODO.',
    },
    {
      judge: "investor",
      text: "Clinics paying per location is a real model. Two maybes is not traction.",
    },
    {
      judge: "engineer",
      text: "Credit for saying it straight. Most teams pretend the TODO isn't there.",
    },
    { judge: "tired", text: "they explained the stack when i asked what it is. classic." },
  ],
  oneLiner: "the one that put the waiting room on a QR code",
  strongAnswers: [
    [
      "Name the SMS provider you'd wire in, and where: onTurnClose in server/notify.ts.",
      "Say what's real today: the QR join and the live queue.",
    ],
    [
      "Name the buyer: the clinic, per location.",
      "Give a price a clinic manager would sign off on.",
    ],
    [
      "One sentence: a clinic's waiting room on a QR code.",
      "Say who it's for before how it's built.",
    ],
  ],
  // Weighted to 5.1 of 10: a middling sheet, so the rubric leaves the odds at 37.
  criteria: [
    {
      key: "technical",
      score: 4,
      reason: "Joining the queue is real; the SMS alert and offline mode aren't in the code yet.",
      findings: ["claim-1", "claim-2"],
      source: "panel",
    },
    {
      key: "demo",
      score: 7,
      reason: "The demo loads and the QR join works on it.",
      findings: ["demo"],
      source: "panel",
    },
    {
      key: "impact",
      score: 5,
      reason: "Clinics paying per location is a real buyer, but there's no pilot yet.",
      findings: [],
      source: "panel",
    },
    {
      key: "pitch",
      score: 4,
      reason: "Asked what it is, they described the stack instead of the waiting room.",
      findings: [],
      source: "panel",
    },
    {
      key: "defense",
      score: 6,
      reason: "They owned the missing SMS and said what they'd wire next.",
      findings: ["claim-2"],
      source: "panel",
    },
  ],
  fixes: [
    "Wire Twilio into onTurnClose in server/notify.ts and demo a real text.",
    "Replace the flat six minutes in estimateWait with the clinic's real pace.",
    'Cut "works offline" from the README until there\'s a service worker.',
  ],
  reviews: {
    engineer: {
      status: "changesRequested",
      comment: {
        file: "server/notify.ts",
        excerpt: '  // TODO: send the SMS\n  console.log("turn close", ticket.id);',
        startLine: 3,
        body: "The headline feature is a log line. Send one real text before the demo.",
      },
    },
    investor: {
      status: "commented",
      comment: {
        file: "server/estimate.ts",
        excerpt: "  return position * 6; // minutes, flat for now",
        startLine: 2,
        body: "Clinics buy accurate waits. A constant six minutes is the pitch's weak spot.",
      },
    },
    tired: {
      status: "approved",
      comment: {
        file: "server/queue.ts",
        excerpt: "export async function joinQueue(clinicId: string, name: string) {",
        startLine: 3,
        body: "scan, join, sit down. i get it. that part works.",
      },
    },
  },
};

/** One scripted session: the repo, the model's output, and what the team answers. */
export type DemoFixture = {
  id: string;
  repo: string;
  scan: Scan;
  answers: readonly { text: string; score: number; reason: string }[];
  panel: Panel;
};

export const SAMPLE: DemoFixture = {
  id: DEMO_ID,
  repo: DEMO_REPO,
  scan: DEMO_SCAN,
  answers: DEMO_ANSWERS,
  panel: DEMO_PANEL,
};

const T0 = Date.UTC(2026, 10, 7, 18, 0, 0);

function must(r: ReturnType<typeof applyScan>): SessionState {
  if (!r.ok) throw new Error(`demo fixture: ${r.error}`);
  return r.session;
}

/** The sample session at each point it can be shown from. */
export type DemoAt =
  | "start"
  | "scanned"
  | "grilling"
  | "asking"
  | "answered"
  | "deliberation"
  | "deliberated"
  | "verdict"
  | "share";

export function demoState(at: DemoAt, now = Date.now(), f: DemoFixture = SAMPLE): SessionState {
  let s = newSession(f.id, f.repo);
  if (at === "start") return s;
  s = must(applyScan(s, f.scan));
  if (at === "scanned") return s;
  s = must(advance(s, "scan"));
  if (at === "grilling") return s;
  if (at === "asking") return must(issueQuestion(s, 0, now));
  f.answers.forEach((a, i) => {
    s = must(issueQuestion(s, i, T0 + i * 60_000));
    s = must(acceptAnswer(s, i, a.text, T0 + i * 60_000 + 12_000));
    s = must(settleAnswer(s, i, { score: a.score, reason: a.reason }));
  });
  if (at === "answered") return s;
  s = must(advance(s, "grilling"));
  if (at === "deliberation") return s;
  s = must(applyPanel(s, f.panel));
  if (at === "deliberated") return s;
  s = must(advance(s, "deliberation"));
  if (at === "verdict") return s;
  return must(advance(s, "verdict"));
}
