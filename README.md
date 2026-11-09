# Would This Win?

Face a panel of three AI hackathon judges before the real ones. Paste a public GitHub repo (and a demo link, if you have one) and the panel:

1. **Scans the code.** Every claim in your README is checked against the files it names: backed, mocked (faked with hardcoded or mock data), missing, or unclear. A demo link is opened to see whether it loads.
2. **Grills you.** Three questions, one from each judge, about your weakest spots. Each answer is scored.
3. **Gives a verdict.** Odds of winning, a judging sheet scored 1 to 5 on technical execution, demo, impact, pitch and defense, and three fixes.
4. **Looks again.** Push fixes and ask for a re-review: the panel reads the diff since the last review and credits each fix it can see in the added code.

The odds are computed in code from fixed point values. The model never sets them, and everything it says about the code is checked against the files it read.

[wouldthiswin.com](https://wouldthiswin.com)

## Stack

Next.js 16 (App Router), Supabase Postgres, GitHub API, Claude Haiku 5.5.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run lint` | ESLint |
| `npm run signals -- <repoUrl> [demoUrl]` | Print the fetched repo data and computed signals for any public repo |
| `npm run clear-test-data` | List sessions made by local runs and tests (`-- --yes` deletes them) |
| `npm run judges` | Rebuild the judge sprites from `art/judges` |

## API

`POST /api/sessions` with `{ "repoUrl": string, "demoUrl"?: string, "previousId"?: string }` starts a session. `previousId` makes it a re-review of your own finished review of the same repo, and needs new commits since.

Errors come back as `{ error, message }`, where `error` is a key of `copy.errors`.

Limits: 3 sessions per IP per 24 hours, plus a global daily cap (`DAILY_CAP`, default 50). A scan of a commit already scanned in the last 24 hours is reused instead of run again.
