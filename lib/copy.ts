// All user-facing text lives here.

export const copy = {
  meta: {
    title: "Would this win?",
    description:
      "Paste your hackathon repo. Get scanned, get grilled by three judges, and watch your odds move live.",
  },
  brand: "wouldthiswin",
  close: "Close",
  header: {
    act: "Act {n} of 4",
    question: "Act 2 of 4: question {i} of {total}",
    share: "Your night, wrapped",
  },
  landing: {
    headline: ["Would", "this", "win?"],
    subhead:
      "Paste your hackathon repo. Get scanned, get grilled by three judges, and watch your odds move live.",
    repoLabel: "Your GitHub repo",
    placeholder: "github.com/you/your-project",
    button: "Face the panel",
    starting: "Finding a panel",
    underButton: "About 4 minutes. 3 questions, 30 seconds each. Free, no sign-up.",
    versus: "Or challenge a friend: same panel, two repos",
    versusSoon: "Coming soon",
    board: {
      heading: "Yesterday's board",
      note: "updates daily, never shows repos",
      empty: "Nobody posted yesterday. Tonight's results show up here tomorrow.",
    },
  },
  judges: {
    engineer: { name: "The Engineer", initials: "EN" },
    investor: { name: "The Investor", initials: "IN" },
    tired: { name: "The Tired Judge", initials: "TJ" },
  },
  // Scan findings. They describe evidence, never motives, and never use "unbacked".
  scan: {
    notFoundIn: "Couldn't find {missing} in {paths}.",
    notFoundLabel: "Couldn't find {missing}",
    foundIn: "Found in {path}.",
    foundLabel: "{claim}: found in code",
    citedUnread: "Points to {path}, which wasn't read.",
    citedNothing: "No file shows this yet.",
    quoteMissing: "Couldn't find the quoted line in {path}.",
    notRead: "Couldn't read the files where this would live.",
    notAllRead: "Only some of the files where this would live were read.",
    notConfirmed: "Couldn't confirm this from the files read.",
    cantVerify: "{claim}: couldn't verify",
  },
  odds: {
    label: "Chance to win",
    // Read out by screen readers whenever the odds move.
    announce: "Chance to win now {odds} percent, {direction} {amount}: {reason}.",
    current: "Chance to win: {odds} percent.",
    sinceArrived: "{delta} since you arrived",
    up: "up",
    down: "down",
    unchanged: "unchanged",
    silence: "Said nothing",
    demoLoads: "Demo link loads",
    demoDead: "Demo link is dead",
    bulkFirstCommit: "Most of the code arrived in one commit.",
    late: "Answered after the buzzer",
  },
  acts: {
    scan: {
      eyebrow: "The scan",
      title: "Every claim, traced to code.",
      claims: "README claims",
      files: "Your files",
      reading: [
        "Reading the README.",
        "Walking the file tree.",
        "Checking the demo link.",
        "Tracing each claim to a file.",
        "Writing the panel's questions.",
      ],
      noClaims: "The README doesn't claim anything checkable. Judges will notice that too.",
      notFound: "Couldn't find {missing}",
      notFoundPlain: "Couldn't find it",
      searched: "Looked in {paths}",
      demo: "Demo link",
      demoLoads: "Loads: {host}",
      demoDead: "Dead: {host}",
      commits: "First commit",
      commitsDetail: "Added most of the files in the repo today.",
      skip: "Skip",
      restart: "Back to start",
      footer: {
        unbacked: "The Engineer saw the red line. So did the other two.",
        unclear: "The panel has questions about the amber lines.",
        clean: "Every claim checks out. The panel will have to dig.",
      },
      next: "Face the panel",
    },
    grilling: {
      answerLabel: "Your answer",
      hint: "Enter to answer. Silence counts as an answer too.",
      counter: "{n} of {max}",
      counterLabel: "{n} of {max} characters used",
      thinking: "{judge} is writing something down.",
      riding: "Riding on this answer: up to {max} points",
      you: "You",
      silence: "(silence)",
      next: "Leave the room",
      tenSeconds: "10 seconds left.",
      // Used when the scoring call fails twice. Nobody loses points for our outage.
      unscored: "Didn't catch that. No change.",
      // When the judge's own reaction can't be shown: the score stands, this line replaces it.
      noted: {
        tired: "noted.",
        investor: "Noted. Moving on.",
        engineer: "Noted. Next question.",
      },
      // An answer that tries to give the judge instructions, in each judge's voice.
      injection: {
        tired: "nice try. that's not an answer.",
        investor: "Instructions aren't a business model.",
        engineer: "Prompt injection isn't a feature. Answer the question.",
      },
    },
    deliberation: {
      eyebrow: "Deliberation",
      title: "They're talking about you.",
      channel: "#panel-{name}",
      readOnly: "You can read this. You can't reply.",
      night: "Your night so far",
      next: "See the review",
    },
    verdict: {
      matter: "In the matter of demo day",
      caption: "The Panel v. {name}",
      finalOdds: "Final odds",
      remember: 'Judges will remember it as "{oneLiner}"',
      notGuilty: "Not guilty",
      guilty: "Guilty",
      sentence: "Sentence, to be served before 10 AM",
      next: "Next: your night, wrapped",
    },
    share: {
      eyebrow: "Tap through, then post",
      title: "Your night, wrapped.",
    },
  },
  tiers: {
    winner: "Winner.",
    top3: "Top 3, probably.",
    honorable: "Honorable mention.",
    participating: "Thank you for participating.",
  },
  errors: {
    notFound:
      "Couldn't find that repo. Either the link's wrong or it's private. Judges can't see private repos either.",
    emptyRepo: "This repo is empty. Bold strategy. Push some code, then come back.",
    emptyReadme: "Your README is empty. Judges read the README first. Write one, then come back.",
    githubDown:
      "GitHub is rate-limiting us. Even GitHub needs a break. Try again in a few minutes.",
    invalidUrl: "That's not a GitHub repo link. Paste something like github.com/you/your-project.",
    judgeFailed: "The panel fell asleep mid-session. Try again.",
    rateLimited:
      "You've faced the panel 3 times today. The verdict isn't changing. Come back tomorrow.",
    dailyCap: "The judges are asleep. Come back tomorrow.",
    stale: "The panel has moved on. Picking up where you are.",
    alreadyAnswered: "You already answered that one. Judges don't take do-overs.",
    network: "Lost the connection to the room. Try again.",
  },
  notFoundPage: {
    message: "This session doesn't exist. Maybe it never happened. Maybe it was that bad.",
    button: "Face the panel",
  },
} as const;

export type Copy = typeof copy;

/** Fills {name} slots in a copy string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
