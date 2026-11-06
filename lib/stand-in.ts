// Fixed data that stands in for the answer scoring and deliberation calls until they're
// built, so the whole flow can be clicked through. It goes through the same state machine
// and odds engine as the real calls will.

import type { Panel } from "./session";

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
