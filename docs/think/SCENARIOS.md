# SCENARIOS — adversarial pass on Model D (2026-08-31)
Format: scenario → how Model D as decided FAILS. Repairs listed separately
at the end (smallest revision that survives). Precise enough to become tests.

## Failures, reported first

- **S1 — The signup never happens (repeat of history).** Model D's step one
  is the X developer signup — the exact blocker that killed Scout for nine
  months (F7). If it's left as "Pedro will do it later," the whole
  investigation dies here and this document becomes AMENDOA-SCOUT.md #2.

- **S2 — Silent auth death.** X OAuth tokens expire/revoke. A routine that
  fails auth sends no briefing; no briefing looks identical to "quiet day."
  Pedro notices in week 2 that nothing arrived since day 3. Test: a run with
  a 401 from X must still send an email saying "BROKEN: reauthorize."

- **S3 — Stale-by-arrival.** Email is pull, not push. Briefing sent 09:00,
  read 11:30 → every opportunity is 3+ hours old, scores are lies, replies
  land in MOB threads. Test: opportunity age at *send* time must be <90 min,
  and the briefing must state a "dead after HH:MM" line per item.

- **S4 — Copy-paste friction kills the 15 minutes.** Reading email → copy
  draft → open X app → find tweet → paste → edit → post is ~6 steps × 8
  opportunities. Budget blown, habit dies by day 5.

- **S5 — Slop drafts.** If Claude's drafts are generic ("Great point! This
  resonates…"), editing costs more than writing. Pedro stops using drafts,
  then stops opening briefings. Test: Pedro uses/edits ≥50% of drafts in
  week 1, else the voice prompt is declared broken and rewritten.

- **S6 — Wrong List, wrong tier.** Watching 500k+ accounts → every thread is
  a MOB in minutes; watching <1k accounts → zero reach. The 2026 playbook
  (R-3) says target 2–10× Pedro's size. A List built on "accounts I admire"
  instead of "accounts where I can win the reply" invalidates the test.

- **S7 — No baseline, no verdict.** If day-0 followers/impressions aren't
  recorded (U4), day 30 produces vibes, not an answer. Wishful thinking
  (the main error source) fills the gap.

- **S8 — No success threshold, moving goalposts.** Without a pre-committed
  number (U6), +23 followers on day 30 becomes "promising, extend it" —
  forever. The test must be falsifiable before it starts.

- **S9 — Irregular use poisons the data.** Mintbird crunch → 9 active days
  out of 30. Calendar-based verdicts ("30 days, no growth") would kill a
  thesis that was never actually run. Metrics must be per-active-day.

- **S10 — Spend surprise or silent stop.** List too big / polling too eager →
  cap hit day 12 → briefings stop silently (compare S2). Or no cap set →
  the surprise bill Pedro feared. Test: estimated month cost printed in
  every briefing footer; cap alarm = explicit email.

- **S11 — Secrets in the wrong place.** The scheduled routine needs the X
  bearer token and Gmail access. If the token gets pasted into a prompt or
  committed to the repo, that's a credential leak (Dragon regime). Where the
  routine's secret lives must be decided at build time, not improvised.

- **S12 — Follower count is a lagging metric.** 30 days × ~7 replies/day may
  move impressions and profile visits before followers. Judging on followers
  alone can kill a working loop. (Inverse of S8: threshold must include
  leading indicators.)

- **S13 — X changes rules mid-test.** Pricing or reply policy shifts again
  (it did in Feb, Apr 2026). Sunk cost must not keep the test running under
  changed economics; a rule change triggers a DECISIONS.md review, not
  improvisation.

- **S14 — The briefing is judged, not the strategy.** If Pedro replies to
  2 of 8 opportunities because 6 felt off-target, the *filter* failed, not
  the reply thesis. Without logging "why skipped," day 30 can't tell filter
  failure from thesis failure. Every skip needs a one-tap reason captured
  (even just "off-topic / too late / bad draft").

## Smallest revisions that survive (adopted into the build spec)

- **R-S1:** X signup happens *in the kickoff session, together* — it is
  Phase 5 step 1, with Claude walking every click, before any code/routine
  is written. Nothing else starts until the token exists.
- **R-S2/S10:** Every run ends in an email, always — opportunities, "quiet
  window," or "BROKEN/CAP HIT: do X." Silence is defined as a bug. Footer
  shows month-to-date estimated API spend.
- **R-S3:** Runs are scheduled at 2–3 fixed times Pedro picks as "I will
  look within 15 minutes" windows (phone in hand). Each item carries a
  dead-after time; the briefing subject line carries the count + freshest
  score so email triage takes 2 seconds.
- **R-S4:** Each opportunity is one tap: an `x.com/intent/post?in_reply_to=
  <id>&text=<draft>` link — X's official web intent — opens the compose box
  with the draft pre-filled; Pedro edits and posts. One tap, not six steps.
  (Compliant: user-initiated, X's own share flow.)
- **R-S5:** Voice prompt is built from 20–30 of Pedro's real posts/replies;
  drafts reviewed in week-1 check-in against the ≥50% usage bar.
- **R-S6:** List curated at kickoff against explicit criteria: niche fit +
  2–10× Pedro's follower count + posts ≥1×/day. 30–60 accounts.
- **R-S7/S8/S12:** Day-0 baseline (followers, 28-day impressions, profile
  visits) recorded in the repo at kickoff, alongside a pre-committed
  threshold covering one lagging metric (net followers) and one leading
  metric (profile visits or reply impressions). Numbers set with Pedro
  before run 1; logged in DECISIONS.md as D5.
- **R-S9:** Verdict computed on ≥20 active days; if <20 active days by day
  30, the test extends rather than concludes — logged, not silently.
- **R-S11:** Secrets live outside the repo and outside prompts (routine
  environment/secret store — exact mechanism verified at build time; if the
  scheduled-agent platform can't hold a secret safely, fall back to a
  local launchd-scheduled run on Pedro's Mac).
- **R-S14:** Briefing includes mailto/reply-back one-liners (or a daily
  10-second reply-to-email) capturing per-item outcome: replied / skipped +
  reason. Logged into a flat file in the repo by the next run.
