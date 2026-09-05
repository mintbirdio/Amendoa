# RESEARCH — anti-slop + voice-learning loop (2026-08-31)

## R-V1. X's algorithm scores slop, at the source (primary evidence)
Cloned [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm) (For You
feed, open-sourced 2026-05-15) and read it:
- `grox/flows/upa/classifier_banger_initial_screen_gemma.py:50` — every post
  gets a literal **`slop_score`** from an LLM classifier at screening time.
- `abuse-enforcement-service/.../enforcement_post.yaml:39` — a post labeled
  **`llm_slop_post`** gets tagged **`RiskyHighVizReply` for 30 days**
  (ttl 2592000000 ms). X's enforcement layer treats LLM-slop specifically as
  a *reply-visibility* risk. Pedro's fear ("I'll be logged as AI slop and
  hurt my brand") is not paranoia — it is a literal label with a 30-day TTL.
- `home-mixer/scorers/ranking_scorer.rs` — replies carry their own ranking
  weight, boosted for bidirectional-follow relationships (mutuals' replies
  rank higher → relationships compound).
- `grox/flows/upa/prompts.py` — **the actual scoring prompts are excluded
  from the repo "to reduce gameability."** Nobody outside X has the exact
  rubric; anyone selling "the formula" is guessing.
- Secondary sources ([Postory](https://postory.io/blog/x-algorithm-2026),
  [OpenTweet](https://opentweet.io/blog/x-algorithm-open-source-github-2026)):
  Grok scores replies ~0–3 for quality; "this"/emoji-only replies ≈ 0.

**Conclusion: the only durable strategy is being genuinely non-slop. The
human-writes-the-final-words rule (D11) is not just taste — it's ranking
survival. One lazy AI paste can carry a 30-day risk label.**

## R-V2. What reads as slop in 2026 (the tells moved)
- Em-dashes are no longer the tell — models were trained away from them
  ([Fast Company on the viral Economist/Hassid report](https://www.fastcompany.com/91584243/how-to-identify-ai-generated-writing-viral-report-has-surprising-new-clues-economist),
  [Dataconomy](https://dataconomy.com/2026/08/04/how-to-spot-ai-writing/)).
- Current tells: **"it's not X, it's Y"** negation-pivots; **rule of threes**;
  **verbosity**; unusually light punctuation; and above all **pattern
  density** — the same tidy rhythm recurring at regular intervals. No single
  marker convicts; repetition does. Academic: [Measuring AI "Slop" in Text](https://arxiv.org/pdf/2509.19163).

## R-V3. How voice-matching actually improves (research + practitioners)
- **Few-shot beats instructions**: 2–5 real writing samples elicit strong
  style imitation; zero-shot style descriptions are weakly effective
  ([style-transfer research roundup](https://arxiv.org/html/2510.13302v1),
  [personalization survey](https://arxiv.org/html/2411.00027)).
- **LLMs still struggle with informal, idiosyncratic voices** even with
  demonstrations ([Catch Me If You Can? Not Yet](https://arxiv.org/pdf/2509.14543)) —
  independent support for seeds-not-drafts (D11).
- **Learning from edits is the studied loop**: rewrite-toward-user-style
  from post-edit pairs ([Can You Make It Sound Like You?](https://arxiv.org/html/2604.24444v1)),
  per-user LoRA adapters when data accumulates ([Small Is Enough](https://arxiv.org/html/2607.29238v1)).
- **Practitioner consensus** ([How to Make Claude Write Like You](https://artificialcorner.com/p/voice)):
  a voice profile is mostly **what you reject** — a growing banned-list from
  real corrections outperforms flowery style descriptions.

## The learning loop (designed from the above, using data we already have)
Pedro's posted replies are public → fetchable via the X API at owned-read
rates; the seeds each briefing sent are in the routines' run logs. So every
week we can reconstruct **(seed → what Pedro actually posted)** pairs for
free — the exact training signal the research says to use.

Weekly cycle (Sundays):
1. Scorecard routine pulls Pedro's week: follower count vs the +50
   trajectory, replies posted, their impressions/likes → Telegram.
2. In-session review: diff seeds vs posted replies. Every divergence
   becomes either a new **banned pattern** (he cut it) or a new **anchor
   phrase** (he wrote it). Update the routine's STARTER spec + few-shot
   anchors. The spec converges on Pedro by rejection, per R-V3.
3. Engagement on his replies (public metrics) tells us which *angles* work —
   feeding angle selection, not just wording.

## Applied now (routine prompt v3)
- Banned in seeds: negation-pivot constructions ("it's not X, it's Y"),
  lists of three, >1 sentence, generic observations that fit any tweet.
- Required: one concrete specific lifted from the target tweet (a name,
  number, or claim) — the cheapest honest anti-slop signal.
- Few-shot anchors switched to Pedro's strong ORIGINALS (his old low-effort
  replies are the habit being replaced, not the target).
