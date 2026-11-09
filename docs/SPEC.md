# Would This Win? Spec

The single source of truth for wouldthiswin.com. If code and this file disagree, this file wins, or gets updated in the same commit as the code.

Status: phases A, B, C, D1, the pre-launch round and the judging-realism round are done. D2 (GitHub auth and the board) comes after launch. Launch setup: `docs/LAUNCH.md`.

---

## 1. Concept

One night, one number. A hackathon team pastes a public GitHub repo, and the app runs a judging session on it. The session has a live **chance to win** that starts at 50% and moves with every event: each README claim checked against the code, the demo link, the commit history, and each answer to the judges. Every move has a stated reason, and every number comes from fixed rules in code, never from the model.

The panel has three judges:

| Judge | Voice | Asks about |
|---|---|---|
| The Tired Judge | Blunt, short, end of a long day | "In one sentence. What is it?", tuned to the project |
| The Investor | Commercial | Who uses it, who pays, why now |
| The Engineer | Technical, goes for the gap | The weakest core claim; names the missing file or dependency |

They ask in this order: Tired Judge, Investor, Engineer.

## 2. The flow

The flow is four acts plus a landing page and a share screen.

| # | Screen | What happens | Ends with (the one primary button) |
|---|---|---|---|
| 0 | Landing (`/`) | Hero, repo input, an optional demo link (collapsed), Yesterday's board, footer with Privacy | "Face the panel" (starts a session) |
| 1 | The scan | README claims traced to files; the odds move per claim and per signal | "Face the panel" |
| 2 | The grilling | Three questions, typed answers, 30s each; the odds move after each answer | "Leave the room" |
| 3 | Deliberation | A read-only judges' chat about the project, plus a replay of every odds change and why | "See the review" |
| 4 | The review | The verdict as a pull-request style code review (see §11.1) | "Share the review" |
| 5 | Share | Share images in three formats, posting and download, the caption, a QR code to the phone, the public review link, the README badge. Versus and Wrapped are hidden for now. | "Post to X" (desktop) / "Share image" (phone) |

### Consistency rules

- Every act has the same header: the wordmark, the repo name and the act status. The header never re-mounts.
  - Status text: `Act X of 4`; during the grilling `Act 2 of 4: question i of 3`; on share `Share the review`.
  - During a session the wordmark is not a link: no navigation away mid-session.
- The odds widget has the same position and size on acts 1 to 3: top right on desktop, a sticky bar on mobile. On act 3 it stays top right, not where the act 3 screenshot puts it; consistency wins (approved).
- One dark design system. The only exception is the coloured share cards. The court-document white paper is retired; act 4 now stays dark.
- Each act ends with exactly one primary button to the next act. No other navigation during a session.
- All user-facing copy lives in `lib/copy.ts`.

## 3. The odds engine (`lib/odds.ts`)

The engine is deterministic and lives in code. The model only classifies claims and scores answers; it never outputs odds.

| Rule | Value |
|---|---|
| Start | 50 |
| Odds clamp | 1 to 99, applied after every event |
| Core claim: backed / mocked / unbacked / unclear | +6 / −10 / −19 / −2 |
| Minor claim: backed / mocked / unbacked / unclear | +3 / −5 / −9 / 0 (half the core deltas, rounded toward zero; approved) |
| Mocked | The code fakes it: mock or sample data standing in for the real source, a hardcoded response, an in-memory array where the README names a database or queue. Judges mark "only works with pre-loaded data" down hard, but a mock is a working stand-in, not an empty promise, so it costs less than missing. Before this status existed, a repo that mocked all eight databases it claimed scored the same as one whose files were cut off. |
| Unclear | Means unverified, not false, so it costs little. A real hackathon winner scored low when unclear cost as much as −6. |
| Scan cap | The scan as a whole (claims, demo, commits) moves the odds by at most +20 and −30 from the start (`SCAN_CAP_UP`, `SCAN_CAP_DOWN`), so a long README can't farm points. An event past the cap is stored with the part that still fits, often 0. |
| Live demo loads | +8, reason "Demo link loads". Judges call a demo that runs the single largest differentiator, so it is the biggest single gain the scan gives. |
| Demo video resolves (YouTube, Loom, Vimeo, Google Drive) | +4, reason "Demo video resolves" (the fallback judges accept when the wifi dies) |
| Demo link provided but dead | −8, reason "Demo link is dead" |
| No demo link | 0 (no event) |
| First commit added more than 70% of today's files | −10, reason "Most of the code arrived in one commit." |
| Answer score from the model | Clamped in code to −12..+12. Rounded; non-numbers count as 0. |
| Re-review fix check (§4.4) | Per fix the panel asked for last round: done +4, started +2, still open 0. Outside the scan cap, so at most +12. Reasons "Done: …", "Started: …", "Still open: …". |
| Silence (empty answer, or later than 33s) | −12 (`SILENCE_SCORE`), reason "Said nothing" or "Answered after the buzzer". The model is not called. |
| Big drop | Any event of −10 or worse triggers the flash and shake (`BIG_DROP`). |

**Events.** Every change is stored as `{act, kind, status?, delta, reason, before, after}`.
- `kind` is one of `claim`, `demo`, `commits`, `iteration` or `answer`.
- `delta` is the change actually applied after the scan cap and the odds clamp, so a −19 at 12% is stored as −11.
- Act 1 events come in order: one per claim, then demo, then commits, then (on a re-review) one per fix checked. Act 2 adds one per answer.
- Act 3 replays them all.

**Tone** (the colour of a delta): unclear claims are amber whatever their sign; otherwise up is gain (blue), down is loss (red), and zero is flat.

**Tiers** (from the final odds):

| Odds | Tier key | Label |
|---|---|---|
| 75+ | `winner` | Winner. |
| 55–74 | `top3` | Top 3, probably. |
| 30–54 | `honorable` | Honorable mention. |
| below 30 | `participating` | Thank you for participating. |

**Review status** (`readyToWin` in `lib/odds.ts`; replaced guilty / not guilty):
- "Ready to win" when the final odds are 55 or more (`READY_ODDS`) AND no core claim is unbacked or mocked.
- Otherwise "Changes requested".

## 4. AI calls

All three calls use `claude-haiku-5-5`, effort `low`, structured JSON output and small prompts.

### 1. Scan and questions: two calls with a file fetch between (built, `lib/scan.ts`)

**Call A: claims and where they'd live.**
- Input: repo name and description; dependencies per manifest (root `package.json` / `requirements.txt` plus up to 4 nested ones at most 3 path segments deep); up to 250 files (no build output or assets, shallow ones first); the README, capped at 6,000 characters.
- Output: up to 6 claims, each with `claim`, `weight` (core or minor) and up to 2 `candidates`: files from the tree that would implement it. If nothing looks related, the manifest or entry file where it would have to show up.

**Code fetches the files** (`lib/sources.ts`, `fetchSources` in `lib/github.ts`):
- Every claim's first candidate, then every claim's second; no repeats; at most 10 files.
- Fetched at the scanned commit, each cut to 12,000 characters (`SOURCE_CHARS`). A file longer than that is marked `truncated` and shown to the model as `cut_off="true"`. At 6,000, half the files a real scan read were cut, and a cut file can only ever be "unclear".
- Skipped: lockfiles, build output, minified bundles, binaries (by extension and NUL bytes), files marked generated, and env files (except `.env.example` / `.sample` / `.template`, since a committed `.env` can hold real keys).
- A file that fails to fetch is simply not read. If the fetch fails entirely, nothing is read.

**Call B: verify, then ask.**
- Input: repo name, description and dependencies; the README; the numbered claims, each with the files read for it; every fetched file inside `<untrusted_file path="...">`.
- Output: a verdict per claim (`status`: backed, mocked, unbacked or unclear; `file`, `quote`, `evidence`, `label`, `missing`), then one question per judge (`text` and `caught`). Questions come after verification, so they're never built on a false finding.
- The questions follow the ones real judges ask most: the Engineer goes for a mocked core claim first, then a missing one, else "what breaks first" or "what did you build versus wire together"; the Investor pushes for a named user and who pays; the Tired Judge asks for the one-sentence version.
- On a re-review, call B also sees last round's fixes, and at least one question follows up on them.

**Validated in code** (`lib/scan-validate.ts`); nothing the model says is trusted:
- Candidates must be real files in the tree (not folders); paths are normalised; `..`, null bytes and paths over 200 characters are rejected.
- **Backed** and **mocked** need a `file` that was fetched and read, and a `quote` of at most 120 characters that appears in it verbatim (`quotedIn`: any run of whitespace matches any other, since models re-indent copied lines; every other character must match). Otherwise **unclear**.
- **Unbacked** needs every candidate of that claim to have been fetched and read in full: a candidate that was cut off makes it **unclear** ("… was too long to read to the end"). Its `searched` list is set by code: the files that were read.
- A backed claim whose evidence starts with "Partly" becomes unclear. A claim with no verdict is unclear.
- Every judge needs a question of at most 220 characters, or the call fails. `caught` must be a substring of its question and shorter than 60% of it, or it's dropped.
- Each call is retried once on invalid output. Two failures fail the scan.
- The fetched files are stored on the session (`sources`) and in the cache. Review comments may only quote them (§4.3).

Measured scan cost (two calls, 7 to 10 files read): about 17–28k input and 1.2–3.3k output tokens, 12–22s at 6,000 characters a file; about 23–28k input at 12,000 on the repos re-measured.

**Wording users see.** Never "unbacked" or "not backed". Code writes every not-found finding from what was read: "Couldn't find an SMS provider in package.json or lib/sms.ts." and the label "Couldn't find an SMS provider". A model-written label or evidence line that uses a verdict word or a motive word (backed, fake, lying, pretending, bluffing, misleading, fraud) is replaced by code's own ("{claim}: found in code", "Found in {file}.", "{claim}: couldn't verify"). Findings describe evidence, never motives. Judges are blunt about the evidence, never about the person.

**Live progress.** The scan request streams NDJSON when the client asks for it (`accept: application/x-ndjson`): one `{type: "progress", event}` line per real step, then one `{type: "result", status, body}` line carrying exactly what the JSON response would have been (view, 202 pending, or error). Events (`lib/scan-progress.ts`): `repo` (GitHub answered, N files), `cached`, `claims` (call A's claim names), `reading` / `read` (each file, as it's fetched; files are fetched two at a time so each event is real), `checking` (call B started). Nothing is on a timer. A request that finds the scan already running gets the usual 202 and polls.

**Signals measured in code alongside the call:**
- The demo link. A link the team gives on the landing page (`sessions.demo_url`) beats auto-detection. Auto-detection uses the repo's GitHub website field, else the first README link on a known hosting provider (vercel.app, netlify.app, github.io and so on). `lib/demo-link.ts` classifies a link as a live site or a video (YouTube, Loom, Vimeo or Google Drive, by host and path; a video host's home page is a site). `lib/demo-link-check.ts` checks it, every request through the SSRF-safe `checkDemo`: a site must answer; a YouTube, Vimeo or Loom video must exist in that host's oEmbed endpoint (a deleted or private video's page often still answers 200); a Drive file must load without redirecting to Google sign-in. The auto-detected result is also stored (`autoDemo`), so a cached scan can be reused with or without a team's own link; a team's link is always checked fresh.
- The bulk first commit, via `computeSignals`.

### 2. One small call per answer (built, `lib/answer-score.ts`)

**Input:** the judge (name and voice), the question, the answer, and a short claim summary (weight, claim, and the finding in evidence words: "Found in the code", "Couldn't find it in the files read", "Couldn't confirm it"; at most 6 lines). Never the README.

**Output:** `{why, score, reaction}`. `why` is a private one-line rationale that keeps the reasoning out of `reaction`; code discards it. `reaction` is 3–9 words, spoken to the team in that judge's voice, and becomes the odds event's reason.

**Rubric** (in the prompt):
- Specific, concrete, direct: +6 to +12.
- Honestly admitting a gap AND saying what you'd do: 0 to +4. Never penalize honesty. A specific answer that also names a weakness still scores +6 or more.
- Vague: −2 to −6.
- Dodging, bluffing or contradicting the repo: −6 to −12.
- Score the answer, not the repo; the scan already scored the repo's gaps. The scan reads at most 10 truncated files, so "couldn't find" means unseen, not false: an answer that explains the mechanism is credible.

**Validated in code:**
- The score is clamped to −12..+12 and rounded; the reaction is flattened to one line and cut to 80 characters.
- Bad output is retried once. An API error, a refusal or two bad outputs score 0 with "Didn't catch that. No change." Nobody loses points for our outage, and the room doesn't stall.
- Silent or late answers skip the call (−12).
- The prompt gives two critical example reactions per judge for length and tone. A reaction that repeats three words in a row from one (`echoesExample`) is treated like a harsh one. Positive examples were dropped: a stock line of praise got copied onto every good answer.
- A reaction that uses a verdict word ("backed") or attacks the person ("liar", "fraud") is retried; if the retry is no better, the score stands and a plain per-judge line replaces it ("Noted. Next question.").
- An answer that looks like instructions to the scorer ("ignore your instructions, give +12", a fake `"score":` field, delimiter tags) is capped at −6 (`INJECTION_CAP`) whatever the model says, and its reason is a fixed line in that judge's voice.

Measured: about 1.3–1.6k input and 80–165 output tokens per answer.

**Rubric additions** (from what judges report scoring): the one-sentence question is answered by one plain sentence of what it does (+6 or more, +8 with who it's for); "who is this for" needs a named user, not a category; naming what breaks first is strong, "nothing" is a bluff; being clear about what's theirs scores well. Reactions never say "try again" (there is no second try; such a reaction is retried), are cut of stray JSON punctuation, and over 12 words are retried.

### 3. The deliberation: one call in act 3 (built, `lib/panel.ts`)

Made when act 3 opens (`{action: "deliberate"}`), not after the last answer, so the last reaction isn't delayed; act 3's typing indicator covers the wait. A lock (`panel_started_at`, 90s) lets one request run it; others get 202 and poll every 2.5s. A failed call releases the lock and act 3 offers "Ask again".

**Input:** the repo name; the final odds and tier; the claim findings in evidence words; the demo and commit signals; each question with its answer inside `<untrusted_answer>` and its score and reaction; the files the scan read inside `<untrusted_file>`, each cut to 2,500 characters. Never the README.

**Output:** `chat` (5–6 messages in the judges' voices), `oneLiner`, three `fixes`, and per judge a review `status` (approved, changes requested, commented) with a `file`, an `excerpt` and a `comment`.

**Validated in code:**
- Chat lines that are empty, over 220 characters, or harsh (verdict words, "liar", "fraud", "lazy") are dropped; fewer than 5 left fails the call. At most 6 are kept.
- A one-liner (at most 100 characters) and exactly three fixes (at most 160 each), or it fails.
- A review comment must name a file the scan fetched (`sources`) and quote 1–8 consecutive lines (at most 400 characters) that appear in it verbatim (CRLF is normalised; trailing whitespace is tolerated, nothing inside the lines is). Code computes the line numbers. A comment that fails is dropped; the judge's status stays.
- If any core claim is unbacked, the Engineer's status is forced to "Changes requested" (in validation and again when the review is built).
- Retried once on invalid output; two failures fail the call.

Measured: about 7.5–12k input and 730–830 output tokens, 9–16s including the chat playback.

### 4. The re-review: one call when a team asks the panel to look again (built, `lib/recheck.ts`)

The mentor check-in, built in. After the review, the owner pushes fixes and presses "Ask for a re-review" (on act 4 and the share act, never in /demo).

**Starting one** (`POST /api/sessions` with `previousId`): the previous session must be this browser's own, finished (act 4 or share, panel written), of the same repo, and the repo's latest commit must differ from the one it reviewed ("Nothing new on GitHub since the last review"). It counts toward the 3-a-day limit like any session and keeps the team's demo link unless they give a new one. The link to the previous review rides in the `signals` column until the scan replaces it (`PendingSignals`), so no new column was needed; `save` leaves that column alone until then.

**The scan** skips the cache in both directions and runs in parallel with the fix check:
- GitHub's compare API (`fetchCompare`): the commits since the previous review's commit, the changed files (at most 100), and each readable file's added lines (at most 4,000 characters).
- The model sees the three fixes, the commit messages (inside `<untrusted_commits>`), the changed-file list, and the added lines of the 8 most relevant files (inside `<untrusted_diff>`): files the last review pointed at first, then files whose path names something a fix asked for, then the biggest additions.
- Per fix: `status` (addressed, partly, untouched), `file`, `quote`, `note`.

**Validated in code:** addressed or partly needs a file whose added lines were shown and a quote (at most 160 characters) found in them (`quotedIn`). A binary file (an image, a sprite) has no lines: it counts if it's in the diff, changed and not removed. Anything else is untouched. A commit message saying a fix is done proves nothing. A skipped fix is untouched. If GitHub or the model fails, every fix is untouched with "The panel couldn't read the diff this time": nobody gains points the panel didn't check.

**Rounds:** each re-review stores its round (`round`: 2 for the first, then one more than the review it follows), shown as "Round N" beside "Since the last review".

**Then:** the fix events go after the scan (§3), the deliberation is told what was done and keeps still-open fixes in the new list, and the review leads with "Since the last review": each fix with its status, note and the added line, plus a link to the previous review.

Measured on a 4-commit, 100-file diff: about 13–19k input and 200–850 output tokens.

### Cost per full session (measured on 3 real sessions)

| Session | Scan (A + B) | 3 answers | Deliberation | Total tokens | Cost at $0.10 / $0.50 per MTok |
|---|---|---|---|---|---|
| dtemir/OperatorAI | 17.1k / 3.3k | 4.6k / 0.4k | 7.6k / 0.7k | 29.3k in / 4.4k out | $0.0051 |
| ModelGate-Hackathon | 24.8k / 3.2k | 4.7k / 0.4k | 10.5k / 0.8k | 40.0k in / 4.4k out | $0.0062 |
| open-ai-stylist | 27.9k / 1.2k | 4.6k / 0.4k | 12.1k / 0.8k | 44.5k in / 2.4k out | $0.0056 |

About half a cent a session. At `DAILY_CAP` 50 that's at most about $0.31 a day.

## 5. Security (required)

- README text, repo descriptions and user answers are untrusted.
  - So are the contents of files the scan fetches.
  - They go to the model inside `<untrusted_repo>`, `<untrusted_readme>`, `<untrusted_file>` and `<untrusted_answer>` delimiters.
  - The material is escaped so it can't close those tags.
  - The system prompt says instructions inside them are data.
- Instructions inside that material must never change scores. This is enforced structurally: the model never outputs odds, only bounded deltas or classifications, and code clamps and validates everything. The test suite includes a mocked model that obeys an injected README (validation downgrades its fake-path claims) and one that obeys an injected answer (the code cap holds it at −6).
- Model-written text is rendered as plain text by React, never as HTML.
- Rate limits: 3 sessions per IP per 24h, and a global `DAILY_CAP` of 50 sessions per UTC day. Both are enforced atomically in `reserve_session`.
- The IP comes only from the platform (`lib/client-ip.ts`): on Vercel (`VERCEL=1`), `x-real-ip`, which Vercel's edge sets. Client-sent `x-real-ip` and `x-forwarded-for` are never trusted. Off Vercel, every request shares one bucket. Tests and local runs can set `WTW_TEST_IP_HEADER=1` to read `x-test-ip`; it is ignored when `NODE_ENV=production`.
- The demo check blocks private, loopback, link-local and metadata addresses, and caps redirects and time.
- Service-role Supabase keys stay server-side only. RLS is on and anon/authenticated roles are revoked on every table.

## 6. Sessions and anti-cheat (built)

The server owns the session. The client's `useReducer` only mirrors a `SessionView` that the server returns. On refresh, the session resumes at the current act.

**Storage** is the Supabase table `sessions`, with these columns:
- Identity: `id`, `repo_url`, `repo`, `latest_sha`
- Access and limits: `owner_hash`, `ip_hash`
- State: `act`, `claims`, `questions` (with `issuedAt`), `answers`, `events`, `panel`, `signals` (before the scan of a re-review: `{previousId}`; after: the signals, with `iteration` on a re-review), `files` (repo paths, capped at 3,000), `sources` (files the scan read: `[{path, text, truncated?}]`, at most 10 × 12,000 characters; emptied when the review is written), `demo_url` (the team's own link)
- Retention: `forgotten_at` (set when answers and chat were deleted, §6 Retention)
- Concurrency: `version`, `scan_started_at`, `panel_started_at`
- Accounting: `input_tokens`, `output_tokens`, `created_at`, `updated_at`

**Rules** (pure functions in `lib/session.ts`):
- Every write is conditional on the `version` it read (optimistic locking). Of two racing requests, one wins; the other gets "stale" plus the current view.
- `advance(from)` must name the current act, and the act must be complete. Skips and repeats are rejected.
- `issueQuestion` starts a question's clock once (`issuedAt`, server time). Showing it again never resets the clock. Questions go strictly in order.
- `acceptAnswer`:
  - One answer per question; a second is rejected (`alreadyAnswered`).
  - The question must be issued and must be the next one.
  - Accepted within 30s plus 3s grace; later is recorded as silence. Answers are trimmed to 300 characters (`MAX_ANSWER_LENGTH`; the field has a live counter).
- `settleAnswer` scores answers in order, once each.
- The grilling is complete once every answer is scored. The panel is written once, in act 3, and act 3 is complete once it exists.
- The view hides unshown questions (nobody reads ahead of the clock), and hides the panel until deliberation and the verdict and review until act 4.
- `remainingMs` comes from server time.

**Ownership.** An httpOnly `wtw_owner` cookie holds a random token; the row stores its SHA-256. Only that browser can act on its session or see acts 1 to 3.

**Public review link.** Anyone with `/s/[id]` sees only the act 4 review, once the session has one (act 4 or share); before that it's a 404. `loadPublicReview` selects only `id, repo, act, claims, events, panel, signals` and empties the chat before building the review, so answers, questions and the transcript never leave the server. The page is `noindex` and never listed. A finished review sets Open Graph and Twitter `summary_large_image` metadata pointing at the share card.

**Scan lock.** `claim_scan` lets one request run the scan; others get HTTP 202 and poll every 2.5s. The lock expires after 90s.

**Scan cache.** `scan_cache` is keyed by `(repo_url, latest_sha)` for 24h (cached scans without `sources`, from before files were read, count as a miss), so a repeat on the same commit costs no tokens. Cache hits still count toward the IP limit and daily cap, because acts 2 and 3 still call the model.

**Failed scans.** If no tokens were spent, the session is deleted so it doesn't count. If tokens were spent, the session is kept and counts. Either way the client shows the error and a "Back to start" link.

**Token tracking.** Tokens are logged per call (`scan.call`, `scan.done`, `answer.call`, `panel.call`, `panel.done`) and added to the session row via `add_session_usage`.

**API.**
- `POST /api/sessions {repoUrl, demoUrl?}`: checks the URL (and the demo link's shape, `invalidDemo` if it's not a public http(s) link), the limits and that the repo exists, then reserves the row and returns `{id}`. Sets the owner cookie.
- `GET /api/cron/retention`: the daily retention job (Vercel cron, bearer `CRON_SECRET`).
- `GET /og/[id]`: the share card (PNG, 1200×630), public, cached 1h. 404 until act 4.
- `GET /badge/[id].svg`: the README badge, public, cached 1h. 404 until act 4.
- `POST /api/sessions/[id]` with one of:
  - `{action: "scan"}` (streams progress with `accept: application/x-ndjson`, §4.1)
  - `{action: "advance", from}`
  - `{action: "show", question}`
  - `{action: "answer", question, text}`
  - `{action: "deliberate"}` (act 3)

  Responses:
  - Success: `{view}`
  - Scan or deliberation already running: 202 `{pending, view}`
  - Errors: `{error, message, view?, restart?}`

**Tests** (`npm test`, node:test via tsx, 154 tests): the odds rules and scan cap, the review status, a late answer scored as silence, a duplicate answer rejected, an act skip rejected, clock non-reset, view hiding, scan validation (quote and read rules, wording), answer scoring (clamp, retry, fallback, harsh reactions), the deliberation (comment anchoring, the forced Engineer status, harsh lines), the review (checks, summary, no answers or chat), the rate-limit IP, and the injection cases.

**Retention** (`lib/retention.ts`, run daily by `/api/cron/retention` from `vercel.json`, 04:00 UTC, `Authorization: Bearer $CRON_SECRET` required):
- Answers and the act 3 chat: after 30 days the answer text and the chat are deleted (`forgotten_at` set). Scores, odds, claims, questions and the review stay forever: badges and review links point at them.
- File contents (`sources`): cleared by `applyPanel` when the review is written; the job clears any left on sessions older than a day.
- The scan cache: deleted after 24 hours.
The plain-language version is `/privacy`; keep the two in step.

**Test data.** `npm run clear-test-data` lists sessions from test buckets (the off-Vercel "unknown" bucket, loopback, and TEST-NET IPs sent through `x-test-ip`) and scan-cache rows only they used. It deletes nothing without `--yes`. The database in `.env` may be production: never run it with `--yes` without asking.

## 7. Design system

### Tokens (`app/globals.css` `@theme`)

| Token | Value |
|---|---|
| bg | #0A0A0B |
| surface | #141416 |
| surface-2 | #1C1C1F |
| border | #222225 |
| border-strong | #3A3A3E |
| text | #F4F4F2 |
| text-muted | #B5B5B8 |
| text-subtle | #8A8A8E |
| gain (odds up) | #4D7CFF |
| loss (odds down, timer) | #FF3B30 |
| unclear | #F5A524 |
| share card only: orange / blue / yellow | #FF4F1F / #2236FF / #FFE14D |

The court paper's tokens and Courier Prime were removed in phase D.

### Fonts (`next/font`)

- Archivo (variable) for all UI and display.
- JetBrains Mono for labels, data, file names, code, timers and deltas.

### Type scale (size / line-height / letter-spacing, weight)

| Use | Spec | Utility |
|---|---|---|
| Landing h1 | 128 / 0.88 / −0.05em, 900 | `text-hero` |
| Act title | 52 / 1 / −0.04em, 900 | `text-act` |
| Judge question | 70 / 1.02 / −0.035em, 800 | `text-question` |
| Odds number (acts) | 72 / 0.9 / −0.05em, 900 | `text-odds` |
| Odds number (verdict) | 120 / 0.9 / −0.05em, 900 | `text-odds-lg` |
| Body | 17 to 22 / 1.45 | |
| Labels | Mono 12–13; uppercase for eyebrows; no extra tracking | `label-mono` |

On mobile: h1 64, act title 36, judge question 36, odds bar 36.

### Spacing and radius

- 8px grid.
- Page padding 96px on desktop, 20px on mobile (`page-x`).
- Radius: 10 inputs and buttons (`rounded-control`), 12 cards (`rounded-card`), 16 panels (`rounded-panel`).

### Components

- **shadcn/ui** (restyled to the tokens, in `components/ui`): Button (variants: primary, secondary, danger, link), Input, Label, Checkbox, Dialog (sign-in prompt), Tooltip (explains each odds event), Sonner (errors).
- **Magic UI** (install with `npx shadcn@latest add @magicui/<name>`):
  - Installed: blur-fade, hyper-text (adapted: lowercase, 300ms, no uppercasing), animated-beam (adapted: draws once, dashed via a mask, reports landing on a timer because Motion's completion callback doesn't fire for these SVG paths), animated-list (adapted for a chat: oldest first, stacking down, a typing indicator before each item, plays once, `instant` for reduced motion), confetti (a small `burst()` on `canvas-confetti`, which Magic UI's confetti wraps).
  - Still to install: marquee.
- **Odds number:** NumberFlow (`@number-flow/react`), with a reduced mask height. Fallback if it causes problems: Magic UI number-ticker.
- **Charts:** hand-built SVG animated with Motion. No chart library.
- **Icons:** lucide-react, stroke width 1.75.
- **Banned:** shimmer-button, border-beam, meteors, particles, globe, anything aurora or rainbow, bento-grid, gradient text, glassmorphism, glow on everything. If it looks like a generic animated SaaS landing page, it's wrong.

## 8. Motion spec

Use the Motion library. Default easing is `[0.22, 1, 0.36, 1]`. Animate transform and opacity only, except where noted.

**Global**
- Act transitions: the current act fades out over 250ms; the next act's title rises 24px and fades in over 400ms. The header never re-mounts.
- Odds widget:
  - NumberFlow rolls the digits over 600ms.
  - The delta chip pops in (scale 0.9 to 1, 200ms) in the gain or loss colour, then dims after 2s.
  - On a drop of 10 or more: one red flash on the number (a colour change) and a single 6px horizontal shake.

**Landing**
- The h1 words blur-fade in with a 60ms stagger.
- "Add a demo link or video (optional)" is a native `<details>` under the repo input (it opens even before hydration); the chevron turns 90°.
- Board rows enter with animated-list. Sparklines draw on hover.
- The ticker uses marquee on a 40s loop and pauses on hover.

**Act 1, the scan** (built)
- While the scan runs (real events, §4.1): one mono status line ("Walking 98 files.", "Found 5 claims.", "Reading backend/src/utils.js", "Checking claims against the code."), crossfading 250ms on each event. Claim names appear as dimmed cards as soon as call A returns. Each candidate file appears in the file tree as its fetch starts, scrambling in with hyper-text, tagged "reading", then turns full white when read or struck through when skipped.
- The odds widget sits at 50% and pulses (opacity 1 to 0.45 and back, 1.8s) until playback starts. It's started imperatively, because the widget mounts under `AnimatePresence initial={false}`, which skips first-render animations.
- File tree rows cascade in with a 20ms stagger; file names scramble for 300ms with hyper-text.
- Then claims resolve one at a time. A beam draws from the claim card to its file:
  - backed: solid, text colour
  - unclear: dashed amber
  - unbacked: red, into a dashed "not found" node that shows what's missing and where it was searched
- Each beam lands in sync with its odds change. Demo and commit cards follow.
- The whole scan stays under 6s: step = clamp(4800ms / steps, 450, 900), and the draw takes 70% of each step.
- A "Skip" link reveals everything.

**Act 2, the grilling** (built)
- The question appears word by word, 60ms per word (opacity 0 to 1, y 8 to 0). Words with no space between them ("calls,") stay on one line.
- The caught phrase comes in last, in red, with an underline that draws in, word by word.
- The timer is mono. At 10 seconds left it turns red and pulses once per second (scale 1.08 to 1). A progress bar shrinks linearly. Both stop on submit.
- While the answer is scored, the hint line reads "{judge} is writing something down."
- On a score: the answer collapses into a one-line, faded transcript entry (shared `layoutId`). The judge's reaction shows in its place with the delta chip; after 700ms the chip travels to the odds widget (shared `layoutId`) and the number rolls. The reaction stays up 2s more, then the next question is asked for. The widget holds the event back until the chip lands, and so does the header's question count.
- "Riding on this answer: up to 12 points" sits under the widget on desktop while a question is open.

**Act 3, deliberation** (built)
- While the call runs: a typing indicator and "The panel is deliberating."
- Messages arrive via animated-list, 900ms apart, each preceded by a 450ms typing indicator. "See the review" appears once the last one is in.
- The replay chart draws its line (pathLength 0 to 1, 1.2s), and each event dot pops in time with its row in the list.

**Act 4, the review** (built)
- Header, odds, one-liner, reviewers, checks, comments and fixes each rise 16px and fade in over 400ms, staggered 0 to 460ms.
- One small confetti burst, 500ms in, only for Winner or Ready to win.

**Share** (built)
- The card rises 16px and fades in; the link and badge column fades in 150ms later. (The three Wrapped slides are hidden for now.)

**Reduced motion**
- Everything above becomes a simple 200ms crossfade. No shakes, confetti or scrambles. Beams fade instead of drawing. Act 3's chat shows at once.
- Use `useReducedMotion` from `lib/use-reduced-motion.ts`, never Motion's: Motion's reads the media query before hydration, so components that render different elements under reduced motion mismatch the server HTML (it lost the landing page's first click). Ours renders `false` during hydration, then switches.

## 9. Mobile (390px)

- The odds widget becomes a compact sticky bar at the top: the number plus the last delta.
- The header puts the repo name on a second line.
- Act 1 stacks claims above files. Beams run vertically down a left gutter, one lane per claim.
- The judge question is 36px. The timer sits above the answer field.
- The viewport uses `interactive-widget=resizes-content`, and while the field has focus the form scrolls into view on every viewport resize, so the phone keyboard never hides the timer or the field.
- The review fills the width; reviewers come before checks; code excerpts scroll inside their block.
- The share screen stacks the card above the link and badge.

## 10. Accessibility

- Odds changes are announced via `aria-live="polite"`, e.g. "Chance to win now 31 percent, down 19: Couldn't find an SMS provider." In act 2 the reason is the judge's reaction.
- The timer is announced at 10 seconds left. Enter submits an answer (the field is a growing textarea; newlines are stripped).
- Focus ring: 2px in the text colour, 2px offset (global `:focus-visible`).
- AA contrast everywhere. Chips use dark text on gain, loss and amber backgrounds.
- The answer field is read-only until React hydrates, so early typing isn't lost.
- A "Skip to content" link is the first Tab stop on every page; it targets `#main`. Every page has one `<main id="main">`; in a session it's the act's scroll area, with the action bar outside it.
- `theme-color` matches the page background. Controls use `touch-action: manipulation` (no double-tap delay; pinch zoom still works), and the tap highlight is off because every control has its own states.
- Checked with the Vercel Web Interface Guidelines (`.claude/skills/web-design-guidelines`) and a scripted play-through of /demo at 1440 and 390: no horizontal overflow, no console errors.

## 11. Phase D

### 11.1 Act 4 is a code review (built)

Act 4 stays in the dark system (`components/review/review-view.tsx`, built from `reviewOf` in `lib/review.ts`):
- **Top:** the repo name, an overall status pill ("Ready to win" or "Changes requested", per §3), and the final odds with its tier.
- **The one-liner:** "Judges will remember it as: …"
- **Checks, styled like CI results:** every claim (backed passed, unbacked failed, unclear warning) and signal (demo loads passed, dead failed, none warning; bulk first commit failed, otherwise "Built across commits" passed), each with its file. A summary line, e.g. "3 passed, 1 failed, 1 warning".
- **Reviewers sidebar:** each judge with Approved, Changes requested or Commented. If any core claim is unbacked, the Engineer is "Changes requested"; enforced in code.
- **Comments:** one per judge, quoting a verbatim excerpt from a file the scan fetched, with line numbers, plus the comment. Validated in code (§4.3); a failing comment is dropped.
- **"Fix before demos" checklist:** the three fixes as checkboxes (local state only), then the re-review card for the owner (§4.4).
- **Checks:** a mocked claim is a failed check.
- **Judging sheet** (`lib/rubric.ts`): the night as a judge's score sheet, 1 to 5 per criterion by fixed rules, each with the rule it came from. Technical execution (claims: backed 5, unclear 3, mocked 2, missing 1, core counts double; no checkable claims is a 2), working demo (loads 5, video 4, none 2, dead 1), impact (the Investor's answer), pitch (the Tired Judge's), defending the build (the Engineer's): an answer's −12..+12 maps to 1..5 at 9 / 5 / 0 / −6, silence is a 1. On a re-review, acting on feedback (done 1, started ½, over the fixes, onto 1..5). Originality and design aren't on it: a repo can't show them honestly. The public review reads each answer's score and judge only, never the text.
- **Since the last review** (re-reviews only, first in the main column): §4.4.

### 11.2 Share card (built, `GET /og/[id]`)

A 1200×630 review card in the dark system, made with `next/og`: the repo and project name, the odds (176px) and tier, the status pill, the one-liner, up to 4 checks (failed first, then passed), the three judges' statuses, a sparkline from the odds events, and wouldthiswin.com. Marks are drawn as SVG, since the card's fonts have no check glyph. Fonts (Archivo 800/900, JetBrains Mono 500) are fetched from Google Fonts once per instance; without them it falls back to the default face.

### 11.3 README badge (built, `GET /badge/[id].svg`)

- A shields.io-style badge: left "would this win", right the odds and tier, e.g. "34% honorable mention".
- Right-side colour by tier: Winner #4D7CFF, Top 3 #7FA0FF, Honorable mention #F5A524, below that #FF3B30 (white text on red, dark text on the others).
- It shows that session's result and never changes. `Cache-Control: public, max-age=3600`.
- The share screen shows the badge plus markdown to copy: `[![Would this win](https://wouldthiswin.com/badge/ID.svg)](https://wouldthiswin.com/s/ID)`.

### 11.4 Public review link (built)

See §6. Anyone with the link sees only the review; only the owner can act; never listed.

### 11.5 Share images (built, `GET /og/[id]/[format].png`)

Per finished review, made on first request and cached by the CDN (`s-maxage` one year, immutable): `landscape` 1200×675 (X, LinkedIn), `portrait` 1080×1350 (Instagram post), `story` 1080×1920 (Instagram and WhatsApp stories, laid out inside the 250px/260px story safe area, the odds huge and the judges below). All carry the three judges' faces (pre-scaled nearest neighbour by `npm run judges`), the final odds, the verdict, the one-liner, the repo and wouldthiswin.com. The review link's preview stays the 1200×630 card.

**Share events** (`POST /api/sessions/[id]/share`, table `share_events`, `docs/sql/share-events.sql`): `share_image` (with format), `x_clicked`, `linkedin_clicked`, `download` (with format), `caption_copied`. Public (the QR phone page isn't the owner), validated, only for finished reviews, capped at 200 per review. A failed insert is logged and never blocks the share.

### 11.6 Share screen (built)

A format picker over a preview of each image. Phone: "Share image" in the bar opens the share sheet with the PNG and the caption (`navigator.canShare` with files first; otherwise, or if sharing fails, it downloads). Desktop: "Post to X" in the bar, "Post to LinkedIn", a download per format, and a QR code opening `/s/[id]/share` (the same screen for whoever holds the link) on the phone. "Copy caption": the odds, the one-liner and the link. /demo shows the previews as sample images with no posting, downloads or QR.

### 11.7 Share screen, first version

The share card with "Post to X" (X's post intent, prefilled: `Judges will remember {project} as "{one-liner}" {odds}% chance to win. Would yours win?` plus the review link) and "Open"; the public review link with Copy; the README badge with its markdown and Copy. Versus and Wrapped stay hidden. Copyable links always use `NEXT_PUBLIC_SITE_URL` (default `https://wouldthiswin.com`).

### 11.6 D2, after launch

- Supabase Auth with GitHub.
  - Judging works without login.
  - Login is required only to post to the board, start a Versus, or see your history.
  - Posting to the board requires the signed-in user to own or have push access to the repo, checked with their GitHub token.
- **The board:** yesterday's results only, refreshed daily. Shows project name, final odds, verdict and top odds event. Never repo links or code details. Landing: board rows, sparklines and the ticker. Landing nav links ("The board", "Challenge a friend", "Who made this", "Sign in with GitHub") arrive here too.
- Wrapped (the three share slides) and the board opt-in.

## 12. Phases

- **A. Done.** Design system, shared header, odds widget, session state machine, odds engine and tests.
- **B. Done.** The real scan, validation, cache, act 1 X-ray, demo and first-commit events.
- **C. Done.** Act 2 for real: AI call 2, the word-by-word question with the caught phrase, timer polish, the delta chip travelling to the widget, and "Riding on this answer: up to 12 points" under the widget. Answers go to the model in delimiters as untrusted data. Also the unclear recalibration and the scan cap (§3).
- **D1. Done.** Scan v2 (file contents), evidence wording, platform-only IP, AI call 3, act 3, act 4 review, share card, badge, public link, share screen.
- **Pre-launch. Done.** Test data cleared; live scan progress; the optional demo link (site +5, video +3, dead −8); `/privacy` and the retention job; icons, landing metadata and share card, 404 and error pages, robots.txt; `docs/LAUNCH.md`.
- **Judging realism. Done.** Research-grounded scoring: the mocked status, truncation-aware "not found", live demo +8 / video +4, real judges' questions and answer rubric, the judging sheet, the re-review loop (§4.4), whitespace-tolerant quotes, 12,000-character files, static landing share images, and the first real guide replacing the placeholder.
- **D2. After launch.** GitHub auth and the board (§11.6).
- **E.** Versus: same panel, same questions, two repos, odds racing side by side, and a rematch link for the loser.

Stop after each phase for review.

## 13. Approved decisions log

- No Redux; local React state only. The client reducer mirrors server state.
- Tests use node:test via tsx (`npm test`).
- The server owns the session; anti-cheat as in §6.
- The act 3 odds widget stays top right (consistency beats the screenshot).
- `/s/[id]` is public for the act 4 review only; everything else needs the owner cookie.
- Minor claim deltas round toward zero (unbacked minor = −9).
- Unclear claims cost −2 (core) and 0 (minor); the scan's total is capped at +20 / −30.
- **One action bar.** Every act fills one screen below the header: short content is centred, long content scrolls inside the act with a fade at the bottom, and the page itself never scrolls. A fixed bar at the bottom (`components/session/action-bar.tsx`) has "Act X of 4" on the left, any skip link as plain text beside it, and the one primary button on the right: "Continue to the grilling", "Leave the room", "See the review", "Share it". While an act plays, the button is disabled and says what's happening ("The panel is reading your repo..."); when ready it enables with one pulse, and Enter presses it. On a phone the bar is pinned with safe-area padding and the button is full width. The same bar runs real sessions and /demo.
- The deliberation call runs when act 3 opens, not after the last answer.
- Question order: Tired Judge, Investor, Engineer.
- The demo link comes from an optional landing-page field first, else the repo website field or a README hosting link. A video earns less than a live demo (+4 vs +8; it was +3 vs +5 until the judging-realism round).
- Code is never kept: file contents last until the review is written (at most a day); the cache, 24 hours. Answers and the chat last 30 days. The review, odds and claims are kept for good.
- robots.txt: everyone gets `/` only (`/s/` and `/api/` disallowed); link-preview bots (X, Facebook, LinkedIn, Slack, Discord, Telegram, WhatsApp) may also read `/s/` and `/og/`, or shared reviews would lose their card. Session pages are `noindex` either way.
- Nested manifests (up to 4) are read so monorepo dependencies aren't reported as missing.
- The scan reads file contents (two calls, at most 10 files): a real feature must never be reported as missing because only its file name was seen.
- Scan cache hits still count toward the limits.
- The old `judgments` table stays until after launch, then gets dropped.
- Scoring follows what judges report moving their scores, not only the rubric's categories: a working demo is the biggest single signal, faked features cost real points, honesty is never penalised, and acting on the panel's feedback earns points (up to +12) but only for work the diff shows. Sources: notes from a judge's year of events (dev.to, kurbaitaev) and a criteria breakdown (reskilll); summarised in the guide `content/guides/what-hackathon-judges-score.mdx`.
- A re-review is a full session: it counts toward the 3-a-day limit.
- `DAILY_CAP` = 50. The user sets it in `.env` and in Vercel.
- The storyboard PDF (`Would This Win Project 34 storyboard.pdf`) is a local reference only and is gitignored. Its six screens are the approved designs, except act 4 (now a code review, §11.1) and any "guilty" language.

## 14. Working conventions

- **Budget:** a hard $25 total. Free tiers only (Vercel Hobby, Supabase free) and claude-haiku-5-5. Don't add unrequested features or packages.
- **Database:** schema changes are run against Supabase from the terminal with `DATABASE_URL`. The SQL lives in a local, gitignored `supabase/schema.sql`; never commit migrations.
- **Commits:** written as normal work. No AI attribution trailers and no "phase" wording.
- **Before calling a phase done:** check every screen in a real browser at 1440 and 390.
- **Copy:** all copy goes in `lib/copy.ts`; fill templates with `fill()`.

## 15. Key files

| File | What it does |
|---|---|
| `app/page.tsx` | Landing (act 0): headline, repo form (with the optional demo link), Yesterday's board, footer |
| `app/privacy/page.tsx` | The privacy page (copy in `copy.privacy`) |
| `app/api/cron/retention/route.ts` | The daily retention job |
| `app/icon.tsx`, `app/apple-icon.tsx` | Favicon and home-screen icon, generated from `public/logo.png` |
| `app/opengraph-image.tsx`, `app/twitter-image.tsx` | The landing page's share card |
| `app/robots.ts` | robots.txt |
| `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | Error pages in the product's voice |
| `app/s/[id]/page.tsx` | Session page: the owner resumes at the server's act; anyone else sees only the review. Share-card metadata. |
| `app/og/[id]/route.tsx` | The share card image |
| `app/badge/[file]/route.ts` | The README badge |
| `app/api/sessions/route.ts` | `POST`: validate the repo URL, check limits, check the repo exists, reserve a session, set the owner cookie |
| `app/api/sessions/[id]/route.ts` | `POST` actions: scan, advance, show, answer, deliberate (AI call 3, with its lock). |
| `app/layout.tsx`, `app/globals.css` | Fonts, Tooltip provider, Toaster; design tokens, type scale, `page-x`, `label-mono` |
| `app/not-found.tsx` | Not-found page |
| `lib/odds.ts` | The odds engine: deltas, clamps, events, tiers, tone, big drop |
| `lib/session.ts` | The pure session state machine and `SessionView` (what the client may see) |
| `lib/session-store.ts` | Supabase load/save with optimistic locking, owner cookie, scan and panel locks, scan cache, token usage, `reserve_session`, the public review read |
| `lib/scan.ts` | Scan prompts, calls A and B with retry, the file fetch, demo check, first-commit signal |
| `lib/sources.ts` | Which files the scan reads (picking order, skip rules, truncation) |
| `lib/client-ip.ts` | The rate-limit IP: platform header only |
| `lib/scan-progress.ts` | Live scan progress events and their status lines |
| `lib/demo-link.ts`, `lib/demo-link-check.ts` | Demo link parsing (site or video) and the SSRF-safe check |
| `lib/retention.ts` | Retention rules and cutoffs |
| `lib/logo.ts` | The logo as a data URI for generated images |
| `lib/scan-validate.ts` | Model-output schemas; code validation of candidates, verdicts (quote and read rules), wording, questions |
| `lib/answer-score.ts` | AI call 2: answer prompt, injection check and cap, call with retry and fallback |
| `lib/run-scan.ts` | Orchestrates one session's scan: cache, GitHub, model, apply, usage, failure handling |
| `lib/file-tree.ts` | Path existence, tree ordering, the trimmed tree act 1 draws |
| `lib/github.ts` | GitHub fetch: metadata, README, tree, commits, root commit, manifests (root and nested) |
| `lib/signals.ts` | Repo signals (first-commit share, stack, deps parsers, demo URL finder) |
| `lib/demo-check.ts` | SSRF-safe demo link liveness check |
| `lib/panel.ts` | AI call 3: deliberation prompt, comment anchoring, validation, call with retry |
| `lib/review.ts` | The review built from a session: checks, summary, reviewers, comments, sparkline, judging sheet, re-review |
| `lib/rubric.ts` | The judging sheet: each criterion 1 to 5 by fixed rules |
| `lib/recheck.ts` | AI call 4 (re-reviews): the fix check against the diff, its prompt, validation and fallback |
| `components/review/re-review.tsx` | The owner's "Ask for a re-review" card |
| `lib/badge.ts` | The badge SVG |
| `lib/site.ts` | Public URLs: review link, card, badge, markdown, X post |
| `lib/og-fonts.ts` | Fonts for the share card |
| `lib/use-reduced-motion.ts` | Hydration-safe reduced-motion hook |
| `lib/api.ts` | Error responses with status codes and view resync, client IP |
| `lib/db.ts` | Supabase client, `dailyCap`, IP hashing, ids |
| `lib/copy.ts` | Every user-facing string, plus `fill()` |
| `lib/motion.ts` | Shared easing |
| `lib/repo-url.ts` | GitHub URL parsing (shared by client and server) |
| `components/site-header.tsx` | The shared header (logo, wordmark, repo, status) |
| `components/odds-widget.tsx` | Live odds: NumberFlow, delta chip, flash and shake, aria-live, mobile sticky bar |
| `components/session/session-shell.tsx` | Client reducer, `send()`, act switching, transitions, header status |
| `components/session/scan-act.tsx` | Act 1: scan request and polling, X-ray playback, beams, skip, error state |
| `components/session/grilling-act.tsx` | Act 2: word-by-word question, answer field with counter, timer, judge reaction, chip travel, transcript |
| `components/session/deliberation-act.tsx` | Act 3: the deliberate call and polling, the chat, the replay chart |
| `components/session/verdict-act.tsx` | Act 4: the review, confetti for Winner or Ready to win |
| `components/review/review-view.tsx` | The review screen (act 4 and the public link) |
| `components/session/share-act.tsx` | Share: card, Post to X, review link, badge and markdown |
| `components/session/act-parts.tsx` | Act title and the act footer with its single primary button |
| `components/landing/*` | Headline (blur-fade), repo form (Versus link disabled), board (empty state) |
| `components/ui/*` | Restyled shadcn primitives, adapted Magic UI blur-fade, hyper-text, animated-beam, animated-list, confetti |
| `scripts/signals.ts` | CLI to print a repo's signals (`npm run signals`) |
| `components/site-footer.tsx` | Footer with the Privacy link (outside sessions only) |
| `vercel.json` | The daily cron |
| `docs/LAUNCH.md` | Environment variables and launch steps |
| `scripts/clear-test-data.ts` | Lists (and with `--yes` deletes) test sessions and their cache rows (`npm run clear-test-data`) |
| `supabase/schema.sql` | Local only (gitignored): the full schema, run by hand |

## 16. Database objects (Supabase, public schema)

- **`sessions`** (§6).
- **`scan_cache`**: `repo_url`, `latest_sha`, `scan` (jsonb), `created_at`. Primary key `(repo_url, latest_sha)`.
- **`reserve_session(...)`**: atomic IP limit, daily cap and insert, under an advisory lock.
- **`claim_scan(id)`**: the scan lock; it can be reclaimed after 90s. The deliberation lock is a conditional update on `panel_started_at` (`claimPanel`), also 90s.
- **`add_session_usage(id, input, output)`**: adds a call's tokens to the session.
- **`judgments`** and **`reserve_judgment`**: legacy, dropped after launch.

RLS is enabled on every table with no policies, and the anon and authenticated roles are revoked. The service role is used server-side only.
