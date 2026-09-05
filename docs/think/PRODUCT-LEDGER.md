# PRODUCT LEDGER — validated mechanisms → future product features

The dot-connector. Every optimization from the proving phase lands here as
one row: what we learned operationally, and what it becomes in the product.
DECISIONS.md holds the why, WORKLOG.md the when; this file is the product
spec accumulating in real time. Status: `validated` (data supports it),
`testing` (live, no verdict), `hypothesis` (reasoned, unproven).

| # | Source | Mechanism learned | Product implication | Status |
|---|--------|-------------------|---------------------|--------|
| P1 | D11 | Finished AI drafts are slop/brand-risk; users must write every posted word | Never ship auto-drafts. Core unit = opportunity card: angle + ≤140-char starter seed, tap-to-copy | validated (2 rejections) |
| P2 | D12 | Reply voice ≠ post voice; calibrate ONLY on the user's real posted replies, never their originals | Voice engine ingests user's posted replies exclusively; originals actively mislead it | validated |
| P3 | D12 | Cleverness/wordplay constraints produce riddles; plain honest questions win | Seed generator defaults to plainest honest question; style bans are config, grown per-user by rejection | validated |
| P4 | D13 | Numeric scoring alone surfaces winnable-but-thin posts; needs an LLM substance pass | Two-stage select: cheap math shortlist → model reads content, judges substance, never pads | validated |
| P5 | D14 | Mega-account watchlists produce CROWDED cards; high-volume authors flood briefings | Per-author card caps; tier-aware tie-break (FIRST on 20k beats CROWDED on 800k); watchlist curation is a first-class feature | testing |
| P6 | VOICE-SPEC | Speed beats size: <15 min on 300k+ = hundreds–thousands of imps; slower = tens | Real-time detection is the moat (Scout's every-minute polling) — 2×/day batch briefings structurally miss windows | testing (4 supports) |
| P7 | GROWTH-LOG | 8.6k impressions → +1 follower: reply reach alone doesn't convert | Product must cover the full funnel: reply targeting AND profile/original-post conversion, else users churn on "impressions without followers" | testing |
| P8 | D5/BASELINE | Falsifiable thresholds set before day 1 keep the test honest | Onboarding sets a measurable 30-day goal from the user's own baseline; product reports against it | hypothesis |
| P9 | VOICE-SPEC | Exemplar rotation: cap ~12, re-picked by outcome+recency, near-dupes deleted | Voice engine maintains a living exemplar set, auto-rotated by engagement outcomes | testing |
| P10 | D8 | Read-only token in cloud, posting tokens never leave user's machine | Security architecture: the product never holds posting credentials; user posts via intent links | validated (design) |
| P11 | LIST-CANDIDATES | Recent-search mining finds in-lane mid-tier accounts, but is 7-day-windowed and spam-heavy | Watchlist builder feature: seeded search + spam filters + human vet step | testing |
| P12 | D9/D11 | Delivery channel matters: email ignored, Telegram cards with buttons acted on | Push-style delivery with one-tap actions; email is a fallback, not a channel | validated (n=1 user) |

Maintenance rule (Pedro, 2026-09-05): every future optimization adds or
updates a row here in the same change that ships it. No orphan learnings.
