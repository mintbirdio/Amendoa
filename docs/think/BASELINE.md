# BASELINE — day 0 of the 30-day proving phase

**Captured: 2026-08-31, via official X API (first successful call of the project).**

## @pedrogedge (id 123838923)
| Metric | Day 0 |
|---|---|
| Followers | **176** |
| Following | 429 |
| Total posts | 902 |
| Listed | 33 |
| Account created | 2010-03-17 |

## X analytics, 28 days (Aug 4–31, from Pedro's CSV export, 2026-08-31)
- Impressions: **124** (median ~1/day; one 50-imp day)
- Profile visits: **0**
- New follows: **0** · Unfollows: 0
- Engagements: 1 · Posts created: 1
- Plain reading: the account is currently invisible. Any test signal will be
  unambiguous against this floor.

## Infrastructure state at day 0
- X API: pay-per-use, **$25 prepaid credits, no auto-recharge** (hard ceiling).
  App `pete_grows` (client 33382727) in project "PEte Grows" (Pay Per Use,
  Production). Credentials at `~/.amendoa/credentials.env` (outside repo).
- Verified working: 2026-08-31, `GET /2/users/by/username/pedrogedge` → 200.

## Success threshold (D5, amended 2026-08-31 pre-day-1 — see DECISIONS)
- Lagging: **net +50 followers by day 30** (176 → 226).
- Leading: **≥25 profile visits in any rolling 7 days by end of week 2**
  (3× rule was meaningless against a 0 baseline). Secondary: weekly
  impressions materially above the 124/28d floor.
- Verdict on ≥ 20 active days; fewer extends the test.

## First live scoring run (pipeline validation, 2026-08-31 16:55 WEST)
- 99 list tweets read (~$0.50); 57 fresh originals; top: 99 FIRST
  @awilkinson (3m), 86 EARLY @dagorenouf, 79 FIRST @petergyang, 79 FIRST
  @davidsenra. Even 100k+ accounts are winnable when caught <15 min.
- Lesson 1: media-only posts (no text) score high but can't be drafted —
  routine deprioritizes them.
- Lesson 2: drafts must voice opinions, not invented autobiography.
