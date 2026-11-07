// A fixed deliberation that stands in for AI call 3 until it's built, so the whole flow
// can be clicked through. It goes through the same state machine as the real call will.

import type { Panel } from "./session";

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
