# Would This Win?

Paste a GitHub repo, get judged before you submit: a verdict, five scores, a one-line roast and three fixes.

[wouldthiswin.com](https://wouldthiswin.com)

## Stack

Next.js (App Router), Supabase Postgres, GitHub API, Claude Haiku 5.5.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values
```

```bash
npm run dev
```

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run signals -- <repoUrl> [demoUrl]` | Print the fetched repo data and computed signals for any public repo |

## API

`POST /api/judge` with `{ "repoUrl": string, "demoUrl"?: string, "pitch"?: string }` (pitch max 280 chars).

Returns `{ id, cached }`, or `{ error, message }` where `error` is a key of `copy.errors`.

Limits: 3 judgments per IP per 24h, plus a global daily cap (`DAILY_CAP`, default 150). Re-judging the same commit with the same demo URL and pitch within 24h returns the cached result and doesn't count toward either.
