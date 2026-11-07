# Launch checklist

## Environment variables (Vercel → Project → Settings → Environment Variables)

Set these for **Production** (and Preview if you use preview deploys). None of them may be exposed to the browser except the one starting with `NEXT_PUBLIC_`.

| Variable | Required | What it's for |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | The three model calls (scan, answer scoring, deliberation), all `claude-haiku-5-5`. About $0.005 per full session. |
| `GITHUB_TOKEN` | Yes | Reading public repos: metadata, README, tree, commits, manifests and the files the scan reads. A fine-grained token with public-repo read only. Without it GitHub's anonymous limit (60 requests an hour) runs out after a few sessions. |
| `SUPABASE_URL` | Yes | The Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side database access (sessions, scan cache, locks). Never `NEXT_PUBLIC_`; RLS blocks every other role. |
| `IP_HASH_SALT` | Yes | Salt for hashing IP addresses for the 3-sessions-a-day limit. Any long random string (`openssl rand -hex 32`). Changing it resets everyone's daily count. |
| `CRON_SECRET` | Yes | Vercel sends it as `Authorization: Bearer …` to the daily retention job (`/api/cron/retention`); the job refuses anything else. Any long random string. |
| `DAILY_CAP` | Recommended | Sessions per UTC day across everyone. Defaults to 50 (about $0.25 a day at most). |
| `NEXT_PUBLIC_SITE_URL` | Optional | The canonical site for copyable links, the badge markdown and share-card URLs. Defaults to `https://wouldthiswin.com`. Set it only if the domain is different. |

**Do not set on Vercel:**

| Variable | Why |
|---|---|
| `DATABASE_URL` | Local only: running schema SQL from a terminal. The app never uses it. |
| `WTW_TEST_IP_HEADER` | Test only: makes the rate limit read a client-sent `x-test-ip` header. Ignored in production anyway, but don't set it. |
| `VERCEL` | Vercel sets it. The rate limit trusts `x-real-ip` only when it's `1`. |

## Database

The schema lives in the local, gitignored `supabase/schema.sql` and is run by hand. These columns were added during this round and are already applied to the project in `.env`: `sessions.sources`, `sessions.panel_started_at`, `sessions.demo_url`, `sessions.forgotten_at`. If production uses a different Supabase project, run `supabase/schema.sql` there.

## Cron

`vercel.json` schedules `/api/cron/retention` daily at 04:00 UTC (Hobby allows one run a day). It deletes answer text and the act 3 chat after 30 days, file contents after a day, and the scan cache after 24 hours. Check the first run in Vercel → Project → Cron Jobs.

## Test data

`npm run clear-test-data` lists sessions from test buckets (local runs, TEST-NET IPs) without deleting; `-- --yes` deletes them. The database in `.env` is production.

## Share events table

Run once before share events can be recorded: `psql "$DATABASE_URL" -f docs/sql/share-events.sql`. Until then the share screen works and each logging call writes a `share.log` error line.
