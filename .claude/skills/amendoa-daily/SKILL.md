---
name: amendoa-daily
description: Amendoa daily iteration — ingest Pedro's new posted replies + metrics into the corpus, evolve the voice spec, refresh the routine prompts, log growth. Run when Pedro says "amendoa daily", "daily iteration", or asks how the X growth test is going.
---

# Amendoa daily iteration

Credentials: `~/.amendoa/credentials.env` (source with `set -a`). Never
commit them. Never post to X. Full context: `docs/think/` (DECISIONS.md is
constitutional) and the memory `amendoa-proving-phase`.

## Procedure (≈5 min, ~$0.15 of X reads)

1. **Fetch reality** (two calls, bearer token):
   - `GET /2/users/by/username/pedrogedge?user.fields=public_metrics` → followers.
   - `GET /2/users/123838923/tweets?max_results=25&tweet.fields=created_at,public_metrics,referenced_tweets,in_reply_to_user_id&expansions=in_reply_to_user_id&user.fields=username`
     → replies since the last GROWTH-LOG row, with impressions/likes/replies-back.

2. **Ingest into `corpus/REPLIES.md`** — only replies Pedro actually
   posted, verbatim, tagged with register (`question` / `observation` /
   `pushback` / `short-take`) and metrics. Also refresh metrics on entries
   from the last ~3 days (impressions keep accruing).

3. **Re-pick the ⭐ exemplars** — max 12, best per register by outcome +
   recency; every exemplar must earn its place representing a cluster
   (delete near-duplicates). Questions weighted per the working hypotheses
   in `corpus/VOICE-SPEC.md`.

4. **Evolve `corpus/VOICE-SPEC.md`** — if Pedro gave feedback since last
   run, each correction becomes a ban (cite origin) or a working
   hypothesis. If a hypothesis has 5+ supporting data points, promote it to
   a rule. Never grow the spec with speculation.

5. **Refresh the routine prompts** if exemplars or spec changed: update
   STEP 4 of both briefing routines via `RemoteTrigger` (load with
   ToolSearch) — trigger ids `trig_01F8hPjCtgSr6XHvegoLU9fb` (13:00) and
   `trig_01WJpeRkYetn3XzpMQUrJhzi` (22:00). Preserve everything outside
   STEP 4; only swap the exemplar list and rules. Fresh uuid per update.
   D12's kill criterion stands: two consecutive slop verdicts from Pedro →
   delete seeds entirely (angle-only cards).

6. **Append a `corpus/GROWTH-LOG.csv` row**: date, followers,
   replies_posted (prior day), day_reply_impressions, author_replies_back,
   one-line note.

7. **Record the trail** (Pedro's directive 2026-09-05 — no orphan
   learnings): any material change (spec, exemplars, targeting, routine
   prompts, delivery) gets (a) a DECISIONS.md entry if it's a decision,
   (b) a WORKLOG.md line, (c) a new/updated row in
   `docs/think/PRODUCT-LEDGER.md` mapping mechanism → product feature,
   and (d) a local git commit of docs/think/ + corpus/ + this skill
   (message: `Amendoa daily: <one-line summary>`). Commit locally only;
   never push without Pedro's ok.

8. **Report to Pedro**, short: followers vs the +50 pace (target 226 by
   ~2026-09-30, ≥20 active days), yesterday's reply performance (top reply
   + impressions), what changed in spec/exemplars, X-credit burn estimate
   (~$1.50/day; $25 pool from 2026-08-31; warn under $5 — top-up at
   console.x.com).

Do NOT: post/reply on X, push to any remote, add features beyond this
loop, or touch the Scout worker (separate milestone).
