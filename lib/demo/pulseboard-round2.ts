// PulseBoard's second round, for the re-judge capture: the team deleted the committed .env,
// renamed the page, and rewrote the README to claim only what the code does. The checks are
// the real lib/checks over the changed files; round one is snapshotted the way a live
// re-judge does it (lib/rejudge.ts snapshotOf).

import { aiDepth, aiDepthFindings, usesPretrained } from "../checks/ai-depth";
import { demoFindings } from "../checks/demo";
import { runChecks } from "../checks";
import { currentOdds } from "../odds";
import { snapshotOf } from "../rejudge";
import type { Claim, Panel, Scan } from "../session";
import { demoState, type DemoFixture } from "./fixture";
import { ANSWERS, FILES, PULSEBOARD, REPO, TREE } from "./pulseboard";

const README = `# PulseBoard

Crowd alerts for venues: a dashboard that colours each zone by how close it is to capacity
and flags the ones about to fill up.

- Zone dashboard, refreshed every 2 seconds from the venue's counts.
- A crowding forecast from the current count. CrowdNet, a trained model, is next.
- Alerts staff before a zone fills up.

## Run it

npm install
npm run dev

## Live demo

https://pulseboard.example.com
`;

const files: Record<string, string> = { ...FILES };
delete files[".env"];
files["app/layout.tsx"] = FILES["app/layout.tsx"].replace(
  'title: "Create Next App"',
  'title: "PulseBoard: crowd alerts for venues"',
);
const tree = TREE.filter((p) => p !== ".env");

const CLAIMS: Claim[] = [
  {
    claim: "Zone dashboard, refreshed every 2 seconds",
    status: "backed",
    weight: "core",
    file: "app/page.tsx",
    evidence: "the page re-reads every zone on a 2 second interval",
    label: "Zone dashboard works",
    missing: null,
    searched: [],
    quote: "const id = setInterval(tick, 2000);",
    line: 13,
  },
  {
    claim: "A crowding forecast from the current count",
    status: "backed",
    weight: "core",
    file: "lib/crowdnet.ts",
    evidence: "predictDensity works from count over capacity, as the README now says",
    label: "Forecast claim is honest",
    missing: null,
    searched: [],
    quote: "const current = zone.count / zone.capacity;",
    line: 6,
    category: "ai",
  },
  {
    claim: "Alerts staff before a zone fills up",
    status: "unbacked",
    weight: "core",
    file: null,
    evidence: "zones turn red on the page; nothing notifies anyone",
    label: "Staff alerts unbacked",
    missing: "notification",
    searched: ["app/page.tsx", "lib/crowdnet.ts", "package.json"],
  },
  {
    claim: "CrowdNet, a trained model, is next",
    status: "unclear",
    weight: "minor",
    file: null,
    evidence: "stated as a plan, not a feature",
    label: "CrowdNet is a plan",
    missing: null,
    searched: [],
  },
];

const snap = {
  repo: REPO,
  tree,
  sizes: Object.fromEntries(tree.map((p) => [p, files[p]?.length ?? 400])),
  files: new Map(Object.entries(files)),
  readme: README,
  envHistory: { ".env": ["2f980c2", "9a41c07"] },
};
const CHECKS = [
  ...runChecks(snap),
  ...demoFindings([{ url: "https://pulseboard.example.com", page: null }], "pulseboard"),
  ...aiDepthFindings(aiDepth(snap), CLAIMS, usesPretrained(snap)),
];

const round1 = demoState("verdict", Date.now(), PULSEBOARD);
const fixes = PULSEBOARD.panel.fixes;

const SCAN: Scan = {
  ...PULSEBOARD.scan,
  claims: CLAIMS,
  signals: {
    demo: { status: "loads", url: "https://pulseboard.example.com" },
    bulkFirstCommit: false,
    checks: CHECKS,
    iteration: {
      previousId: PULSEBOARD.id,
      previousOdds: currentOdds(round1.events),
      round: 2,
      commits: 3,
      filesChanged: 4,
      fixes: [
        {
          fix: fixes[0],
          status: "partly",
          file: ".gitignore",
          quote: ".env",
          note: "Deleted and ignored, but it's still in history: rotate the key.",
        },
        {
          fix: fixes[1],
          status: "addressed",
          file: "README.md",
          quote: "A crowding forecast from the current count. CrowdNet, a trained model, is next.",
          note: "The README now says what the code does.",
        },
        {
          fix: fixes[2],
          status: "addressed",
          file: "README.md",
          quote: "https://pulseboard.example.com",
          note: "A public demo link replaces localhost.",
        },
      ],
      previous: snapshotOf(round1),
    },
  },
  files: tree,
};

const PANEL: Panel = {
  ...PULSEBOARD.panel,
  criteria: (PULSEBOARD.panel.criteria ?? []).map((c) =>
    c.key === "technical"
      ? { ...c, score: 6, reason: "Everything the README claims is in the code now." }
      : c.key === "demo"
        ? { ...c, score: 6, reason: "A public demo link, and it loads." }
        : c,
  ),
  fixes: [
    "Rotate the OpenAI key: the old .env is still in git history.",
    "Train CrowdNet, or keep it labelled as next.",
    "Send staff a real alert when a zone passes 90%, or cut the alerts line.",
  ],
};

export const PULSEBOARD_ROUND2: DemoFixture = {
  id: "capturerun2",
  repo: REPO,
  scan: SCAN,
  answers: ANSWERS,
  panel: PANEL,
};
