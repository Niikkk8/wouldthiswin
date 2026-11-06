// Fixed data that stands in for the three model calls until they're built, so the whole
// flow can be clicked through. It goes through the same state machine and odds engine
// as the real calls will. Replaced call by call: scan, answer scoring, deliberation.

import type { Claim, Panel, Question } from "./session";

export function standInScan(): { claims: Claim[]; questions: Omit<Question, "issuedAt">[] } {
  return {
    claims: [
      {
        claim: "Live queue updates",
        status: "backed",
        weight: "core",
        file: "lib/queue.ts",
        evidence: "Backed by lib/queue.ts",
        label: "Live updates backed by code",
      },
      {
        claim: "SMS alerts when your turn is close",
        status: "unbacked",
        weight: "core",
        file: null,
        evidence: "Nothing in the repo backs this",
        label: "SMS claim unbacked",
      },
      {
        claim: "Works for any hospital",
        status: "unclear",
        weight: "core",
        file: "config/hospital.ts",
        evidence: "Partly: one hospital is hardcoded",
        label: '"Any hospital" is one hardcoded hospital',
      },
    ],
    questions: [
      { judge: "tired", text: "In one sentence. What is it?", caught: null },
      { judge: "investor", text: "Who pays for this?", caught: null },
      {
        judge: "engineer",
        text: "Your README says patients get an SMS. There's no SMS provider anywhere in package.json. So what sends the text?",
        caught: "no SMS provider",
      },
    ],
  };
}

const SCORES = [
  { score: 5, reason: "Clear one-liner" },
  { score: 2, reason: 'Real answer to "who pays"' },
  { score: -4, reason: "Admitted SMS is mocked" },
];

export function standInScore(index: number): { score: number; reason: string } {
  return SCORES[index] ?? { score: 0, reason: "No change" };
}

export function standInPanel(): Panel {
  return {
    chat: [
      { judge: "engineer", text: "it's mocked. at least they said so instead of bluffing." },
      { judge: "investor", text: '"private hospitals, per OPD, per month" is the first real business answer i\'ve heard today' },
      { judge: "tired", text: "i'd remember the one that texts you. if it texted." },
      { judge: "engineer", text: "honest about the gap. still a gap. the demo would've been the text arriving." },
      { judge: "investor", text: "top 5. not top 3." },
    ],
    oneLiner: "the one that texts you when it's your turn.",
    fixes: [
      "Wire up SMS, or strike it from the README. A judge will ask.",
      "Open the demo with a patient's phone getting the text.",
      'Change "any hospital" to "built for one OPD, designed for more."',
    ],
    charge: "of overpromising.",
  };
}
