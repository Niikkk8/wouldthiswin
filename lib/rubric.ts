// The judging rubric. This is a working default; replace it with your own.
// Keep the five criterion names (demo, problem, execution, wow, pitch): they
// are the score keys the model returns.

export const RUBRIC = `
Score each criterion from 0 to 10 (integers). 5 is a typical hackathon project; most teams land between 4 and 6. Save 9 and 10 for work that would stand out in a room of 40 demos.

- demo: Does it work, live, in the first 30 seconds? A demo link that loads and shows the core idea immediately scores high. No demo, or a demo that needs explaining before anything happens, scores low.
- problem: Can you say who it's for in one sentence? Specific users with a real, recognisable pain score high. "Everyone" or a solution looking for a problem scores low.
- execution: What do the code and commits actually show, regardless of what the README claims? Coherent structure, real implementation of the core idea, and a commit history that fits the event score high. One giant first commit, unbacked claims, or scaffolding with little behind it score low.
- wow: Would a tired judge remember it an hour later, after 40 other demos? A distinct identity or one surprising moment scores high. A generic wrapper or the fifth version of the same idea scores low.
- pitch: Does the README make sense without the team in the room? Clear what, who and why in the first lines, plus a screenshot or GIF, scores high. An empty or boilerplate README scores low.

overall (0-100): demo 25%, execution 25%, problem 20%, wow 15%, pitch 15%, each criterion scaled to 100. Then adjust by up to 5 points for things the rubric doesn't list but a panel would notice.

verdict, from overall:
- "Winner." 85-100
- "Top 3, probably." 70-84
- "Honorable mention." 50-69
- "Thank you for participating." 0-49
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
