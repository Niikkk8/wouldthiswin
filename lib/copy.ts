// All user-facing text lives here.

export const copy = {
  meta: {
    title: "Would This Win? Get judged before the judges do.",
  },
  home: {
    headline: "Would this win?",
    subhead:
      "Paste your repo. It gets checked the way judges actually check: your claims against your code, your scope against the clock, and whether anyone remembers you an hour later.",
    placeholder: "github.com/you/the-thing-you-built-at-3am",
    repoLabel: "GitHub repo",
    repoRecognised: "Ready to judge",
    shortcutHint: "Press / to jump here",
    demoPlaceholder: "Demo link, if it works (optional)",
    pitchPlaceholder: "What it does, in two lines. Judges won't read more. (optional)",
    button: "Judge my project",
    underButton: "Free. No sign-up. 3 a day.",
    exampleLabel: "Example result",
    hero: {
      repo: "byte-bandits/fridge-ai",
      pitch: "Recipe ideas from a photo of your fridge",
      overall: 41,
      verdict: "Thank you for participating.",
      roast:
        'README says "custom vision model." package.json says it\'s an API call. Judges check now.',
    },
    examples: [
      {
        repo: "latenight/queue-less",
        pitch: "Live hospital OPD queue tracker over SMS",
        overall: 84,
        verdict: "Top 3, probably.",
        roast:
          "Solves a real problem in one sentence. The README promises SMS alerts; there's no SMS library in the repo.",
      },
      {
        repo: "night-owls/lightpost",
        pitch: "Finds broken streetlights from dashcam footage",
        overall: 92,
        verdict: "Winner.",
        roast:
          "Every claim in the README is backed by code. Judges hate how little there is to say.",
      },
    ],
  },
  nav: {
    brand: "wouldthiswin",
    judging: "How judging works",
    getBack: "What you get",
    examples: "Examples",
    cta: "Judge my project",
  },
  judging: {
    heading: "How judging actually works",
    notes: [
      {
        line: "You're not scored against perfect. You're scored against the six teams before you.",
        reaction: "Be the one they can tell apart.",
      },
      {
        line: "Most teams land mid-range on every rubric category.",
        reaction: "The winner gets decided by what the rubric doesn't list.",
      },
      {
        line: 'After demos, the panel asks each other "which one was the scheduling one?"',
        reaction: "No one-liner, no survival.",
      },
      {
        line: "Teams that admit a weakness score higher.",
        reaction: '"Nothing breaks" loses the room.',
      },
      {
        line: "Online, judges watch the video first. They open your repo only if the video earns it.",
        reaction: "Your README might not get a second look.",
      },
      {
        line: "Some hackathon platforms now audit your repo with AI, checking every claim in your pitch against your code.",
        reaction: '"Custom model" that\'s an API call gets caught.',
      },
    ],
  },
  getBack: {
    heading: "Your pitch says one thing. Your repo says another.",
    subhead: "Here's what it checks, before a judge does.",
    items: [
      {
        title: "Claims vs code",
        body: "Every claim in your README, checked against what's actually in the repo.",
      },
      {
        title: "The one-liner",
        body: "The sentence judges will use to describe you. If it's vague, so is your pitch.",
      },
      {
        title: "What breaks first",
        body: "The weakness to say out loud, before someone asks.",
      },
      {
        title: "Five scores and three fixes",
        body: "Demo, problem, execution, wow factor, pitch. Plus what to fix tonight.",
      },
    ],
  },
  finePrint: {
    heading: "The fine print",
    items: [
      {
        q: "What does it read?",
        a: "Your README, file tree, dependency files and commit history. Plus your demo link, if you add one.",
      },
      {
        q: "Do you keep my code?",
        a: "No. It stores the repo link, a few computed numbers like commit count, and the verdict. Never the code.",
      },
      {
        q: "Private repos?",
        a: "No. If judges can't see it, neither can this.",
      },
      {
        q: "Is it right?",
        a: "It's an AI with a rubric. It can be wrong. So can a panel at 2am. Use it to find problems, not to predict prizes.",
      },
    ],
  },
  aboutNote:
    "Hi, I'm Niket. I've won 5 hackathons. This is the check I wish I'd run before the first one.",
  finalCall: {
    heading: "Your repo is getting read either way.",
    subhead: "Better you hear it first.",
  },
  tray: {
    markers: [
      { id: "black", label: "Pick up the black marker and draw on the board" },
      { id: "red", label: "Pick up the red marker and draw on the board" },
    ],
    eraser: "Wipe the board",
    drawing: "Drawing on the board. Click the marker again or press Esc to put it down.",
  },
  scoreLabels: {
    demo: "Demo",
    problem: "Problem",
    execution: "Execution",
    wow: "Wow factor",
    pitch: "Pitch",
  },
  loading: [
    "Reading your README like a judge on project 34.",
    "Checking your claims against your code.",
    "Looking at when your commits actually happened.",
    "Writing the sentence judges will use to describe you.",
    "Finding what breaks first.",
    "Checking whether your demo link loads.",
  ],
  verdicts: {
    "Winner.": "Fine. You might actually win this. Don't touch anything.",
    "Top 3, probably.": "Close. Fix the three things below and stop adding features.",
    "Honorable mention.": 'Judges will call it "interesting." That\'s not a compliment.',
    "Thank you for participating.": "The free t-shirt was always the real prize.",
  },
  badge: {
    role: "HACKER",
    event: "wouldthiswin.com",
  },
  certificate: {
    title: "Certificate of Participation",
    awardedTo: "Awarded to",
  },
  result: {
    claimsHeading: "Claims vs code",
    claimStatus: { backed: "Backed", unbacked: "Not backed", unclear: "Can't tell" },
    breaksFirstHeading: "What breaks first",
  },
  fixesHeader: "Fix these before you submit",
  deadDemoNote: "Your demo link didn't load. In front of judges, that's the whole presentation.",
  share: {
    template:
      'I asked wouldthiswin.com if my hackathon project would win. Verdict: {verdict} {score}/100. "{oneLiner}"',
  },
  errors: {
    notFound:
      "Couldn't find that repo. Either the link's wrong or it's private. Judges can't see private repos either.",
    emptyRepo: "This repo is empty. Bold strategy. Push some code, then come back.",
    emptyReadme: "Your README is empty. Judges read the README first. Write one, then come back.",
    githubDown:
      "GitHub is rate-limiting us. Even GitHub needs a break. Try again in a few minutes.",
    invalidUrl: "That's not a GitHub repo link. Paste something like github.com/you/your-project.",
    judgeFailed: "The judge fell asleep mid-verdict. Try again.",
    rateLimited:
      "You've been judged 3 times today. The verdict isn't changing. Come back tomorrow.",
    dailyCap: "The judges are asleep. Come back tomorrow.",
  },
  notFoundPage: {
    message: "This result doesn't exist. Maybe it was never judged. Maybe it was that bad.",
    button: "Judge a project",
  },
  footer: {
    madeBy: "Made by",
    name: "Niket",
    portfolio: "https://niket.dev",
    disclaimer: "An AI scores your repo. It can be wrong. So can judges.",
    social: [
      { network: "x", label: "X", url: "https://x.com/niket_tsx" },
      { network: "instagram", label: "Instagram", url: "https://instagram.com/niket.dev" },
      { network: "linkedin", label: "LinkedIn", url: "https://linkedin.com/in/niket" },
    ],
  },
} as const;

export type Copy = typeof copy;
