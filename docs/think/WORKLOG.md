# WORKLOG — proving phase, day by day

What actually got done, when. DECISIONS.md holds the why; this holds the what.
(Before 2026-08-31 the project sat idle since June — last commit 0094506.)

## 2026-08-31 (Sun) — day 0: from idle repo to live system

**Morning/afternoon — think protocol (docs/think/):**
- Ran the full investigation before building anything: CLAIMS.md,
  RESEARCH.md, RESEARCH-VOICE.md, SCENARIOS.md, UNRESOLVED.md written.
- Decisions D1–D8 logged: dogfood-first objective (D1); chose Model D
  "Claude-as-the-app" 30-day proving phase over deploying Scout, a content
  engine, or the full flywheel (D2); success threshold pre-committed —
  net +50 followers by day 30, 176 → 226 (D5); run windows ~13:00 and
  ~22:00 WEST (D7); secrets split — read-only bearer token in the cloud,
  posting tokens only on the Mac (D8).

**X API stood up (first working API call of the project's life):**
- Pay-per-use app `pete_grows`, $25 prepaid, no auto-recharge (hard cap).
- Credentials at `~/.amendoa/credentials.env`, outside the repo.
- Baseline captured (BASELINE.md): 176 followers; prior 28 days = 124
  impressions total, 0 profile visits, 0 new follows. The account was
  invisible — any signal will be unambiguous.

**First live scoring run (16:55 WEST):** 99 list tweets read (~$0.50),
57 fresh originals scored; top: 99 FIRST @awilkinson at 3 minutes.
Proved the watchlist works as-is (D6) — even 100k+ accounts are winnable
when caught <15 min.

**Runtime deployed (D9/D10):** two scheduled Claude routines (opus,
12:00 + 21:00 UTC) — fetch → score → draft → email briefing via Gmail,
after Google-scope and Outlook dead-ends (Outlook permanently banned:
work tenant).

**Evening — first big correction (D11):** Pedro judged the day-0 AI
drafts slop / brand risk. Drafts BANNED; cards now carry an angle + a
≤140-char starter seed only — Pedro writes every posted word. Delivery
switched from Gmail to Telegram bot @amendoa_briefings_bot (Gmail kept
as failure fallback only).

**Pedro posted 6 real replies (day 0 of the test):** ~3,547 impressions
against a 124/28-day baseline; two authors replied back (@jasonfried at
4.7M followers, @lennysan).

## 2026-09-01 (Mon) — day 1: voice loop v2 + daily iteration built

**Morning — second voice correction (D12):** night-1 seeds still slop —
"clever" one-liners. Diagnosis: seeds were calibrated on Pedro's punchy
ORIGINAL posts, but his real reply register is plain words + honest
questions. Fix shipped to both routines: his 4 real posted replies are
now the only calibration examples; cleverness/wordplay/metaphors banned.
Kill criterion pre-committed: two more slop verdicts → seeds deleted
entirely, angle-only cards. No third rewrite.

**Corpus + iteration loop built (the compounding part):**
- `corpus/REPLIES.md` — Pedro's posted replies only, verbatim, with
  registers, metrics, and ⭐ prompt exemplars (cap 12).
- `corpus/VOICE-SPEC.md` v2 — the register, a ban list where every ban
  cites the rejection that created it, working hypotheses (questions
  outperform statements) awaiting 5+ data points before promotion.
- `corpus/GROWTH-LOG.csv` — daily metrics row.
- `.claude/skills/amendoa-daily` skill — the ~5-min/day loop: fetch
  metrics → ingest replies → re-pick exemplars → evolve spec → push
  updated prompts to both routines → log → report.

**Day-1 activity (evening ingestion):** 177 followers (+1). 2 replies
posted — @TrungTPhan (2nd contact) and @karrisaarinen (FIRST position).
Day-0 replies accrued to 3,547 impressions.

**Scoreboard vs threshold:** 177/226, day 1 of 30. Leading indicator
(≥25 profile visits in a rolling 7 days by end of week 2) not yet due.
X credit burn ~$1.50/day against the $25 pool.

**Night — third correction (D13), targeting layer this time:** Pedro
judged the evening cards "not great… could be richer" — winnable but
thin. The numeric scorer never read content. Both routines now select in
two stages: math shortlists top 10, then the model reads each and keeps
only substantive, in-lane posts (quotes/memes/gossip dropped regardless
of score); no padding to 3 — fewer-but-richer or an honest quiet notice.
Day 1 closed with 3 replies (@TrungTPhan, @karrisaarinen FIRST, +1 from
the evening batch).

## 2026-09-02 (Tue) — day 2: quiet day

- 1 reply posted (o5, to @hnshah). No spec/routine changes logged.
- No GROWTH-LOG row captured for the day (backfill at next ingest).

## 2026-09-03 (Wed) — day 3: capture gap closed

- Ran an ingestion pass via the API: day-1 replies (o4 @TrungTPhan
  2,878 imp, q3 @karrisaarinen, s2 @davidsenra), day-2 and day-3 entries
  all landed in `corpus/REPLIES.md`.
- 1 reply posted so far (o6, to @AravSrinivas 1.1M) — posted ~10 min into
  a score-99 FIRST-window opportunity from a manual scan; flagged in the
  corpus to track its outcome (tweet 2095521266908172351).
- Evening: full `amendoa daily` run — 5 more replies ingested (6 total on
  the day, busiest yet), GROWTH-LOG backfilled for Sep 1–3, exemplars
  re-picked (⭐ q1, q3, o1, o4, o8; o2/q2 demoted), VOICE-SPEC v2.1
  (speed-beats-size hypothesis added), both routines' STEP 4 refreshed.

**Deferred (explicitly, not forgotten):** Scout worker deployment for
every-minute freshness + interactive cockpit — named in D11 as this
week's next milestone. Nothing in this phase is committed to git yet;
all work lives in untracked `docs/think/`, `corpus/`, `.claude/`.
