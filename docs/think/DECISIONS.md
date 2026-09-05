# DECISIONS — constitutional log (amend explicitly, never reopen silently)

## D9 (2026-08-31) — Delivery: Gmail connector; amendoa.app email parked
After Google-scope and Outlook dead-ends, briefings send via the reconnected
Gmail connector (validated 17:2x WEST: real briefing delivered). Cloudflare
Email Sending was rejected for now: it requires Workers Paid ($5/mo) and two
$0 paths existed. The amendoa.app DNS move to Cloudflare stands anyway
(enables free Email Routing for receiving, Resend fallback, future infra).
Outlook/M365 is permanently banned for side projects (work tenant) — in
persistent memory.
Reversal: if Gmail sends flake in routines, switch to Resend free tier.

## D10 (2026-08-31) — The runtime is two cloud routines ("Claude-as-the-app")
trig_01F8hPjCtgSr6XHvegoLU9fb (12:00 UTC) and trig_01WJpeRkYetn3XzpMQUrJhzi
(21:00 UTC): claude-opus-5, Entrepreneur environment, Gmail connector,
self-contained prompt (fetch → score → draft → email; BROKEN-email on any
failure; one X API call max per run; never posts to X). Read-only bearer
token lives in the routine per D8. Note: crons are UTC — when WEST ends in
late October the local send times shift an hour; adjust then if it matters.

## D1 (2026-08-31) — Objective: dogfood first, productize only on evidence
Amendoa's next phase exists to grow Pedro's personal X account. Product/
business decisions wait for Pedro's own measured results.
Evidence: Pedro interview (F8, F10). Rejected: build-to-sell now.
Reversal condition: Pedro explicitly changes the objective.

## D2 (2026-08-31) — Model D chosen: "Claude-as-the-app" proving phase
30-day test. A scheduled Claude routine (2–3 runs/day, timed to Pedro's
windows) calls the official X API (pay-per-use, hard spend cap, ~$20/mo),
scores fresh posts from a Pedro-curated X List with Amendoa's scoring
formula, drafts replies in Pedro's voice, and emails a short briefing with
tap-to-reply links. Pedro edits and posts by hand (~15 min/day). Every run
logs outcomes; lessons accumulate in this repo. No app is built until the
loop proves out.
Evidence: CLAIMS.md F6–F10, RESEARCH.md R-1..R-5, Pedro's explicit choice.
Rejected:
- Model A (deploy existing Scout worker + Telegram): Pedro rejects Telegram;
  more moving parts than the proving phase needs. Scout's code remains the
  reference implementation and the upgrade path if D validates.
- Model B (content-first engine): enters saturated AI-content lane Pedro
  distrusts; months of building before evidence.
- Model C (full flywheel now): the exact pattern that produced two finished,
  never-used builds.
Reversal conditions: (a) the proving loop validates → upgrade to real-time
(Scout-style) and/or productize — explicit amendment; (b) 30 days of honest
use with no signal → kill the reply thesis, amend D1.

## D3 (2026-08-31) — Delivery pipe: Gmail
Briefings land as email. Telegram is deleted from the plan.
Evidence: Pedro's choice; Gmail already connected to Claude.
Reversal condition: emails demonstrably missed/stale (see SCENARIOS.md S3).

## D5 (2026-08-31) — Success threshold (falsifiable, set before run 1)
Lagging: **net +50 followers by day 30** (baseline 176 → 226). Leading:
profile visits ≥3× the day-0 28-day rate by week 2. Verdict computed on
≥20 active days; fewer extends the test (logged) rather than concluding it.
Evidence: Pedro's explicit choice from options; guards SCENARIOS S7/S8/S9/S12.
Reversal condition: none — the number is the point. Amend only before day 1.
AMENDED 2026-08-31 (before day 1, as permitted): leading indicator changed
from "3× profile-visit rate" to "≥25 profile visits in any rolling 7 days by
end of week 2" — Pedro's analytics CSV showed the 28-day baseline is 0
visits, making a multiplicative target meaningless. Lagging metric unchanged.

## D6 (2026-08-31) — Watchlist: Pedro's existing "Reply Targets" List as-is
List 2027458630262440124 (public, 97 members, heavily 100k+). Used unchanged
despite S6 tier-skew concern: first live scoring run showed even 130k–390k
accounts yield FIRST/EARLY positions when caught <15 min. Standing
recommendation: add 15–20 accounts in the 2k–50k band during week 1 if
briefing quality says so.
Evidence: live run 2026-08-31 16:55 (score 99 FIRST @awilkinson at 3m; 86
EARLY @dagorenouf; two 79 FIRST).
Reversal condition: a week of briefings dominated by CROWDED/MOB items.

## D7 (2026-08-31) — Run windows: ~13:00 and ~22:00 WEST
Pedro's honest "will look within 15 min" windows (lunch + late evening).
Evidence: Pedro interview. Reversal: missed-briefing pattern (S3).

## D8 (2026-08-31) — Secrets split
Only the app-only **bearer token** (read-only, capped at $25 prepaid) may
live in the scheduled routine's configuration. The OAuth 1.0a user tokens
(can act as Pedro) stay only in `~/.amendoa/credentials.env` on his Mac.
Keys were pasted in-chat during setup; standing advice to regenerate all of
them in the console after the system is stable.
Evidence: R-S11; posting power must not reach the cloud routine.
Reversal condition: none.

## D11 (2026-08-31, evening) — Drafts deleted; Telegram delivery; seeds only
Pedro's verdict on day-0 drafts: AI slop, brand risk. This vindicates
Amendoa v1's original rule ("don't suggest what to write") and Pedro's own
posted view that AI voice-matching is unsolved. Amends D9/D10:
- Delivery: Telegram bot @amendoa_briefings_bot (chat 1941256748), one card
  per opportunity with [Open tweet] and [Reply on X] buttons; Gmail retained
  ONLY as failure fallback.
- Content: finished drafts are BANNED. Each card carries an ANGLE (one line,
  specific) and a STARTER (≤140 chars, tap-to-copy, seed not prose). Pedro
  writes every posted word.
- Next milestone this week: deploy the Scout worker (already built/tested in
  scout/) for every-minute freshness and the interactive cockpit
  (draft-on-demand, regenerate, skip) — the "app with a text box".
Evidence: Pedro's explicit feedback + choice, 2026-08-31 evening.
Reversal: drafts may return only if a voice-training loop makes Pedro rate
them usable — never by default.

## D12 (2026-09-01) — First voice-loop correction: reply voice ≠ post voice
Night-1 seeds (v3 spec) were still slop — contorted "clever" one-liners.
Diagnosis: (a) seeds were anchored on Pedro's strong ORIGINALS, but his
actual reply register is plain words + honest questions (proven: his plain
question earned a personal answer from @jasonfried, 4.7M); (b) the
"mandatory concrete detail + one clever sentence" constraint produced
riddles. Fix shipped to both routines: his four real posted replies are now
the ONLY calibration examples, cleverness/wordplay/metaphors banned, seeds
default to the plainest honest question.
KILL CRITERION (pre-committed): if Pedro judges the next two briefings'
seeds as slop, seeds are deleted entirely — cards go angle-only or pure
targeting. No third rewrite.
Evidence: Pedro's night-1 feedback quoting the seeds; day-0 reply outcomes.

## D4 (2026-08-31) — Compliance posture: human posts everything
## D14 (2026-09-05) — Targeting correction: D6's reversal condition fired
A week in, briefings are dominated by CROWDED items and by @dhh (3 of 18
fresh originals in one scan; deep-technical content Pedro can't add to).
Routine-side fix shipped to both routines' Stage B: (a) deep technical
infrastructure content (Linux distros, desktop envs, hosting hardware,
dev-tool internals) is off-lane unless it touches AI/products/
distribution; (b) max 1 card per author per briefing; (c) when substance
is comparable, prefer the smaller account and less crowded thread.
The real fix is list composition (only Pedro can edit List
2027458630262440124): add 15–20 in-lane accounts in the 2k–50k band per
D6's standing recommendation. Open until Pedro edits the list.
Evidence: Pedro's feedback 2026-09-05 + scan data (top 12: 4× dhh,
7 of 12 CROWDED/GOOD 10+ replies).
Reversal: loosen the author cap if briefings start running empty.

No programmatic replies, ever. Software surfaces + drafts; Pedro posts.
Evidence: R-2 (X blocked API replies Feb 2026); Pedro's anti-slop instinct.
Reversal condition: none foreseeable.

## D13 (2026-09-01, night) — Substance filter: the selector must read
Pedro's verdict on the evening cards: winnable but thin ("could be
richer"). Diagnosis: the numeric score measures winnability (reach ×
freshness × competition) and never reads content — bare quotes, memes and
gossip rank alongside meaty posts. Fix shipped to both routines: two-stage
selection — math shortlists top 10 (min 35), then the routine's model reads
each and keeps only posts with concrete substance in Pedro's lane
(building, AI tools/agents, distribution, startups, unit economics);
quotes/memes/gossip/politics/media-lists dropped regardless of score.
No padding: fewer-but-richer cards, or an honest "nothing rich this
window". Every reply Pedro has rated worth making was on a substantive
post — that's the evidence.
Reversal: if briefings become too sparse (<1 card/day average), loosen the
bar before touching the list.
