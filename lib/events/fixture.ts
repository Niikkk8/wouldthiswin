// A clearly made-up event for tests, fixtures and local development. It never exists in
// production: eventBySlug only looks here outside it.

import type { EventPreset } from "./types";

export const FIXTURE_EVENT: EventPreset = {
  slug: "fixture-hack",
  name: "Fixture Hack (a made-up test event)",
  url: "https://example.com/fixture-hack",
  startsAt: "2026-11-13T09:00:00+00:00",
  endsAt: "2026-11-15T12:00:00+00:00",
  deadlineText: null,
  rubric: {
    criteria: [
      {
        key: "technical",
        name: "Technical execution",
        weight: 40,
        description: "Working code behind every claim in the README.",
      },
      {
        key: "impact",
        name: "Impact",
        weight: 30,
        description: "A named user with a real problem.",
      },
      {
        key: "demo",
        name: "Working demo",
        weight: 20,
        description: "A live demo or video that shows it running.",
      },
      {
        key: "sponsor",
        name: "Sponsor tech",
        weight: 10,
        description: "Real use of a sponsor's API, not just the install.",
      },
    ],
  },
  sponsorSignatures: [
    {
      sponsor: "Example Maps",
      track: "Best use of Example Maps",
      detect: {
        packages: ["example-maps-sdk"],
        imports: ["example-maps-sdk"],
        hosts: ["api.example-maps.test"],
      },
    },
  ],
  extraChecks: [],
  judgeContext: "This is Fixture Hack, a made-up test event. Teams had 48 hours.",
};
