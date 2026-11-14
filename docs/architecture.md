# Architecture

The decisions that shape the code, and why. For the product's original spec and its history, see `docs/SPEC.md`; where the two disagree, this file and the code are current.

## Evidence before opinion

Every finding cites something a reader can open: a file and line range at the exact commit the scan read, a commit, a URL, or the deterministic check that produced it (`lib/findings.ts`). A finding without evidence isn't created. The rubric cites findings by id, the fix list is built from findings, and evidence links point at `github.com/{repo}/blob/{sha}/{path}#L{start}-L{end}`, so they keep pointing at the same lines after the next push.

## Deterministic checks first

Anything a regex, the GitHub API or an HTTP request can answer is a pure function with tests, not a model call (`lib/checks`): secrets in the tree and in history, template leftovers, setup reproducibility, the README checklist, hygiene, live demo checks, timeline signals, AI depth and sponsor track fit. Models are used where judgement is unavoidable: extracting claims from prose, verifying fuzzy claims against code, asking questions, and writing judge lines. `npm run eval` scores the checks against synthetic fixtures.

## The model never computes the score

Models return bounded inputs with reasons: a claim's verdict, an answer's rating from 0 to 10, a criterion's score from 0 to 10. Code validates every one (zod at the boundary, then rules), clamps it, maps names back to keys and computes everything numeric:

- odds events and the scan cap in `lib/odds.ts`;
- the answer rating mapped to an odds delta, `(rating - 5) x 2.4`, in `lib/answer-score.ts`;
- the rubric's weighted aggregate and its single bounded odds event, `(aggregate - 5) x 2`, in `lib/rubric.ts`.

Malformed output gets one retry, then a fallback that never invents a score (an unscored answer moves nothing; unusable criteria fall back to fixed rules).

## Claims are checked by an agent with a budget

`lib/evidence/verify.ts` runs a tool loop (list_tree, read_file, search, read_manifest) over the repo at one commit, under a budget of 40 calls, 600 KB and 25 seconds. Code keeps a citation only if the agent was actually shown those lines; a verdict without one becomes "can't verify". When the budget or time runs out, the answer is "can't verify", never a guess.

## Scans are cached by commit

`lib/scan-cache.ts` keys a scan by owner, repo, head SHA and `SCAN_VERSION`. The same commit, judged by the same checks, gives the same findings, so a second session on an unchanged repo makes no scan-phase model calls. Only findings and file paths are cached, never file contents; on a hit, the files a review quotes are fetched again at that commit. Bump `SCAN_VERSION` whenever checks or prompts change. Sessions whose findings depend on more than the commit (an event's context, a Devpost page, pasted text, a team's window) skip the cache.

## Server-owned sessions and deadlines

The client mirrors a `SessionView` the server builds; it never computes state (`lib/session.ts`, pure transitions, saved with optimistic locking on `version`). The grilling clock is the server's: a question's window starts after its typing time plus a 3-second read, follows the question's kind (45, 75 or 90 seconds), doubles with extended time, and gains 30 seconds with the one lifeline (`lib/deadline.ts`). A voice recording's start is stamped server-side, and its upload is accepted only if that start was before the buzzer.

## Private findings stay private

Secrets, env-file history, timeline and team signals, answers and transcripts are the owner's. `reviewOf(session, audience)` drops private findings for public audiences, the panel prompt never sees them (its words can end up public), and shareable verdicts and their cards are built only from the public review. A review is private until its owner turns on Make shareable; listing on the board and indexing need a second opt-in.

## Untrusted input

READMEs, Devpost pages, pasted submissions, repo files, commit messages, answers and voice transcripts go to models inside delimiter tags, escaped so they can't open or close one (`lib/prompt-safety.ts`). The system prompts say their content is data, and the structure makes injection pointless: models never output scores directly, and an answer that looks like instructions is capped. Fetches of URLs the team supplies go through `lib/demo-check.ts`: GET only, addresses checked at DNS time on every hop, a timeout, a redirect limit and a size cap, and an allow-list where one applies (Devpost).

## Limits and spend

Caps are checked once, when a session starts, by `reserve_session_v2` under an advisory lock (`lib/limits.ts` mirrors its rules): sessions per visitor, sessions per day, and logged model spend per day. Every model call's tokens, cache tokens, cost and duration are written to `session_usage` (`lib/model.ts`, prices in `lib/pricing.ts`), which the spend cap and `npm run stats` read.

## Storage

Supabase Postgres, service role on the server only, RLS on every table with no policies. Schema changes live in `db/migrations`, run by hand in order.
