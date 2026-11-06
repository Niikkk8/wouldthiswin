// The judging rubric. A working default built from how panels actually judge;
// replace it with your own. Keep the five criterion names (demo, problem,
// execution, wow, pitch): they are the score keys the model returns.

export const RUBRIC = `
How judging actually works (use this, not an idealised rubric):
- Judges see 20 to 60 projects, about 2 minutes each, often in a noisy expo. Scores are relative to the room, not to perfection, and most projects land mid-range on every criterion. What separates them is usually something the rubric doesn't list.
- The first 30 seconds decide most of the score: does it run, and does the first sentence say what it is and who it's for.
- Judges score the product, not the code. Code quality, tests, CI, framework choice and team size barely move scores. Do not reward or ask for them.
- Scope against the clock: one complete end-to-end flow beats ten half-built features. Platform-sized ambition in 36 hours scores low.
- Judges ask "what did you build this weekend?" A repo that was mostly written before the event, or arrived in one giant commit, makes that answer hard.
- Naming a weakness out loud scores better than claiming nothing breaks.

Judging format (from <submission>) changes what "demo" means:
- in person: the team demos live at a table and the repo is rarely opened. A missing demo URL is normal; judge the demo on evidence the core flow works (screenshots, video, deployed link, a coherent app in the tree). Don't punish a missing URL below 4 on its own.
- online: judges watch a ~2-minute video first and open the repo only if the video earns it. No video and no working deployed link is close to fatal for demo (2-3). The README is the pitch.
- not stated: assume in person, but say what would change if it's online.

Reading the signals:
- readmeHasVideo / hasLiveLink / demo.loads: evidence the thing runs. demo.defaultTitle true means the deployed page still has a starter title like "Create Next App"; judges notice.
- readmeIsTemplate or readmeOpensWithSetup: the pitch fails its first 30 seconds.
- coreWindowHours and shareInFinal48h: where the work actually happened. Most work inside a 24-72h window fits a hackathon. A large coreWindowHours (weeks), or firstCommitAddedOver70Pct with few commits, suggests pre-built code; mention it plainly, don't accuse.
- committedEnvFile: leaked secrets; a fix to make tonight, and a red flag in front of technical judges.
- llmSdks: if the product is mostly a prompt around one LLM call, judges will call it a wrapper unless the README shows what's added on top.
- authors: context only; never score team size.

Score each criterion from 0 to 10 (integers). 5 is a typical project in the room; 8+ means it would stand out among 40 demos.
- demo: Does the core flow work, end to end, in the first 30 seconds? (Format rules above.)
- problem: Can a judge say who it's for in one sentence? Specific users with a recognisable pain score high; "everyone" or a solution looking for a problem scores low.
- execution: What was really built for this event, and does the scope fit the time? One finished path beats many stubs. Unbacked README claims and pre-built work pull this down.
- wow: Would a tired judge remember it an hour later, and could they say "the one that..."? A distinct idea or one surprising moment scores high. The fifth chatbot, to-do app, recipe-from-fridge app or carbon tracker of the weekend scores low unless it does something the others don't.
- pitch: Does the README (or the first lines of the submission) say what it is, who it's for and why, before any setup steps, ideally with a screenshot or video?

overall (0-100), weights by format, each criterion scaled to 100:
- in person: demo 30%, wow 20%, problem 20%, execution 20%, pitch 10%.
- online: demo 25%, pitch 25%, problem 20%, execution 15%, wow 15%.
- not stated: use in person.
Then adjust by up to 5 points for what a real panel would notice that the rubric doesn't list.

verdict, from overall:
- "Winner." 85-100
- "Top 3, probably." 70-84
- "Honorable mention." 50-69
- "Thank you for participating." 0-49

fixes: three things the team can do before the deadline, each in under an hour, ordered by score gained per minute. Prefer changes to what judges see first (the demo's first 30 seconds, the README's first lines, the video, a broken link) over code changes. Never suggest tests, refactors, CI or "improve code quality".
`.trim();

/** How to produce claims, oneLiner and breaksFirst. Kept apart from the scoring rubric. */
export const FINDINGS = `
claims: up to 4 concrete claims the README makes (features, integrations, technology such as "custom model", scale, platforms). Check each one against the file tree and the dependency files (package.json / requirements.txt) shown in <repo>.
- status "backed": a specific file, folder or dependency supports it. evidence names it, e.g. "twilio in package.json" or "src/sms/ folder".
- status "unbacked": what you can see contradicts it or the expected piece is missing. evidence says what is there instead, e.g. "Only openai in package.json; no model files or training code".
- status "unclear": the file tree and dependencies can't settle it either way. evidence says what you would need to see.
Never invent files, folders or dependencies; only cite what appears in <repo>. If the README makes no concrete claims, return an empty list.

oneLiner: the sentence one judge would use to describe this project to another judge an hour later. Start it with "The one that". Make it specific enough to tell this project apart from similar ones. If the project has no clear identity, say that plainly instead, e.g. "Hard to tell apart from the other AI assistants." Max 160 characters.

breaksFirst: one sentence naming the most likely weakness, the thing the team should mention themselves before a judge finds it. Point at something concrete. Max 200 characters.
`.trim();
