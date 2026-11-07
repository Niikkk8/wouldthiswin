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
    share: "Share the review",
  },
  landing: {
    headline: ["Would", "this", "win?"],
    subhead:
      "Paste your hackathon repo. Get scanned, get grilled by three judges, and watch your odds move live.",
    panel: "The panel",
    madeBy: "Who made this",
    credits: "Niket Shah plays the Engineer. Akshat Kharbanda plays the Investor. Krish Mehta plays the Tired Judge.",
    repoLabel: "Your GitHub repo",
    placeholder: "github.com/you/your-project",
    button: "Face the panel",
    starting: "Finding a panel",
    underButton: "About 4 minutes. 3 questions, 30 seconds each. Free, no sign-up.",
    demoToggle: "Add a demo link or video (optional)",
    demoLabel: "Demo link or video",
    demoPlaceholder: "your-app.vercel.app or a YouTube, Loom, Vimeo or Drive link",
    demoNote: "A live demo that loads is worth +5, a video that plays +3. A dead link costs 8.",
    versus: "Or challenge a friend: same panel, two repos",
    versusSoon: "Coming soon",
    board: {
      heading: "Yesterday's board",
      note: "updates daily, never shows repos",
      empty: "Nobody posted yesterday. Tonight's results show up here tomorrow.",
    },
  },
  judges: {
    engineer: { name: "The Engineer" },
    investor: { name: "The Investor" },
    tired: { name: "The Tired Judge" },
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
    demoVideo: "Demo video resolves",
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
      // The live status line while the scan runs. Each comes from a real server event.
      progress: {
        start: "Opening the repo.",
        repo: "Walking {n} file{s}.",
        cached: "Scanned this commit already. Replaying it.",
        claims: "Found {n} claim{s}.",
        noClaims: "No checkable claims in the README.",
        reading: "Reading {path}",
        skipped: "Skipped {path}",
        checking: "Checking claims against the code.",
      },
      reading: "reading",
      skippedTag: "skipped",
      noClaims: "The README doesn't claim anything checkable. Judges will notice that too.",
      notFound: "Couldn't find {missing}",
      notFoundPlain: "Couldn't find it",
      searched: "Looked in {paths}",
      demo: "Demo link",
      demoLoads: "Loads: {host}",
      demoVideo: "Video: {host}",
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
      typing: "{judge} is typing",
      deliberating: "The panel is deliberating.",
      failed: "The panel couldn't agree. Ask them again.",
      retry: "Ask again",
      night: "Your night so far",
      chart: "Chance to win after each event, from 50% at the start to {odds}% now.",
      next: "See the review",
    },
    verdict: {
      next: "Share the review",
    },
    share: {
      eyebrow: "Share",
      title: "Post the review.",
      card: "Share card",
      postX: "Post to X",
      // Prefilled post. Kept short: X adds the link.
      postText: 'Judges will remember {repo} as "{oneLiner}" {odds}% chance to win. Would yours win?',
      link: "Public review link",
      linkNote: "Anyone with the link sees the review. Never your answers.",
      badge: "README badge",
      badgeNote: "Paste into your README. It shows this result and never changes.",
      copy: "Copy",
      copied: "Copied",
      open: "Open",
    },
  },
  // Act 4 and the public review link.
  review: {
    eyebrow: "Review",
    ready: "Ready to win",
    changes: "Changes requested",
    finalOdds: "Chance to win",
    remember: "Judges will remember it as:",
    checks: {
      heading: "Checks",
      demoLoads: "Demo link loads",
      demoVideo: "Demo video resolves",
      demoDead: "Demo link is dead",
      demoNone: "No demo link",
      demoNoneDetail: "Judges will ask to see it running.",
      bulkCommit: "Most of the code arrived in one commit",
      bulkCommitDetail: "The first commit added over 70% of the files.",
      history: "Built across commits",
      historyDetail: "The history shows the work.",
    },
    passed: "{n} passed",
    failed: "{n} failed",
    warnings: "{n} warning{s}",
    status: { passed: "Passed", failed: "Failed", warning: "Warning" },
    reviewers: "Reviewers",
    reviewerStatus: { approved: "Approved", changesRequested: "Changes requested", commented: "Commented" },
    comments: "Review comments",
    line: "line {n}",
    lines: "lines {from} to {to}",
    noComments: "No comments on the code.",
    fixes: "Fix before demos",
    fixesNote: "Only you see these ticks.",
    yours: "Would yours win?",
    yoursCta: "Face the panel",
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
    invalidDemo: "That demo link doesn't look right. Paste a full link to a live site or a video.",
    judgeFailed: "The panel fell asleep mid-session. Try again.",
    rateLimited:
      "You've faced the panel 3 times today. The verdict isn't changing. Come back tomorrow.",
    dailyCap: "The judges are asleep. Come back tomorrow.",
    stale: "The panel has moved on. Picking up where you are.",
    alreadyAnswered: "You already answered that one. Judges don't take do-overs.",
    network: "Lost the connection to the room. Try again.",
  },
  footer: {
    privacy: "Privacy",
    note: "Judged by three AI judges. Numbers by code.",
  },
  // Plain language. Keep in step with lib/retention.ts.
  privacy: {
    title: "Privacy",
    lede: "What we keep when you face the panel, and for how long. Short version: your answers go after 30 days, your code is never kept.",
    sections: [
      {
        heading: "What we store",
        body: [
          "The public GitHub link you paste, and the commit we judged.",
          "The scan results: the claims from your README, what we found or couldn't find for each, and the odds.",
          "Your three answers, the judges' reactions and scores, and the judges' chat in act 3.",
          "The review: status, checks, one-liner, fixes and review comments.",
          "A demo link, if you gave one.",
          "A hashed, salted version of your IP address, to stop anyone running more than 3 sessions a day. Never the address itself.",
        ],
      },
      {
        heading: "Your code is never kept",
        body: [
          "To check your claims we read up to 10 files from your public repo. We keep them only until the review is written, a few minutes at most, and delete them within a day if you leave before then. A cache of a scan, so the same commit isn't paid for twice, is deleted after 24 hours.",
          "Each review comment quotes a few lines from one of those files, the way a code review does. Those few lines stay with the review.",
        ],
      },
      {
        heading: "What's public",
        body: [
          "Nothing is listed or searchable. Your review link works for anyone you send it to, and it shows only the review: never your answers, the judges' reactions, or their chat.",
          "The README badge shows your odds and tier, and links to that review.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "Your answers and the judges' chat: 30 days, then deleted.",
          "The review, the odds and the claims: for as long as the site runs, because README badges and review links point at them.",
          "File contents from your repo: until your review is written, at most a day.",
        ],
      },
      {
        heading: "Who sees it",
        body: [
          "The judges are AI models from Anthropic. Your README, the files we read and your answers are sent to Anthropic's API to be judged.",
          "Everything is stored in our Supabase database. We don't sell anything, run ads, or use tracking cookies. One cookie remembers which sessions are yours.",
        ],
      },
    ],
    updated: "Last updated {date}.",
  },
  serverError: {
    message: "The panel walked out mid-session. That one's on us.",
    retry: "Try again",
    home: "Back to start",
  },
  notFoundPage: {
    message: "Nothing here. Maybe it never happened. Maybe it was that bad.",
    button: "Face the panel",
  },
} as const;

export type Copy = typeof copy;

/** Fills {name} slots in a copy string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
