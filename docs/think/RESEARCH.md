# RESEARCH — Amendoa revamp investigation (2026-08-31)

## R-1. X API economics (resolves U2 / A2)
Since Feb–Apr 2026 X is pay-per-use for new developers: **$0.005/post read,
$0.010/user read, $0.015/post created, $0.001 owned reads**; no meaningful
free tier; 2M reads/mo cap before Enterprise (~$42k/mo). Legacy Basic
($200/mo) retired, subscribers force-migrated after June 1, 2026.
Sources: [X docs — pay-per-use pricing](https://docs.x.com/x-api/getting-started/pricing),
[Postproxy 2026 guide](https://postproxy.dev/blog/x-api-pricing-2026/),
[twitterapi.io breakdown](https://twitterapi.io/blog/x-api-cost-breakdown-2026).
**Verdict: ADOPT Scout's cost model — it was built on exactly these rates.
A 30–80 account List polled every minute ≈ $10–30/mo with a spend cap.
"Too much money on the API" is a killed fear, not a constraint.**

## R-2. Programmatic replies are dead (resolves U3 / confirms F4)
On Feb 23, 2026 X blocked API replies unless the author mentions/quote-posts
the app first — explicitly to kill LLM reply slop. Non-reply posting via API
remains allowed. "Automating the social part" (likes, follows, replies, DMs)
is prohibited.
Sources: [X Daily PSA](https://x.com/xDaily/status/2026101667976839569),
[piunikaweb report](https://piunikaweb.com/2026/02/24/x-api-blocks-automated-spam-replies/),
[fireply.ai — which tools survived](https://fireply.ai/blog/x-api-reply-restriction-2026),
[opentweet automation rules](https://opentweet.io/blog/twitter-automation-rules-2026).
**Verdict: ADOPT Scout's human-in-the-loop design as the only compliant reply
path. REJECT any "posts/replies on my behalf" feature — Pedro's instinct was
right, and it's now also against the rules.**

## R-3. Does the reply strategy still work in 2026? (supports A1)
Multiple independent 2026 sources converge: replies carry outsized algorithm
weight (claims range 15x–150x vs likes — treat magnitude as folklore,
direction as consensus); the standard playbook for small accounts is ~70%
replies / 30% posts, reply within ~15 minutes, target accounts 2–10x your
size; X Premium materially helps visibility.
Sources: [Sprout Social](https://sproutsocial.com/insights/twitter-algorithm/),
[bisonary — growing with replies](https://www.bisonary.com/blog/how-to-grow-on-twitter-with-replies-in-2026),
[fireply — 2026 algorithm](https://fireply.ai/blog/x-algorithm-2026-explained),
[postory system](https://postory.io/blog/how-to-grow-on-twitter),
[socialrails guide](https://socialrails.com/blog/how-to-grow-on-twitter-x-complete-guide).
**Verdict: ADOPT as prior (secondary sources, all with tools to sell — none
of this replaces Pedro's own 30-day measurement). Amendoa's scoring model
(reach × freshness × low competition) matches the consensus playbook almost
exactly.**

## R-4. Supabird as a model (resolves A5)
No independent reviews found — Trustpilot/Reddit searches return unrelated
products; only marketing copy and AI-directory blurbs. Its "10x growth"
claims are unverified. Its architecture is content-generation-first
(ideas, viral-template rewrites, cross-posting) with an "Engage" reply-finder
— the reply-finder half overlaps Amendoa; the auto-generation half is the
AI-slop lane Pedro already distrusts, now partially blocked by R-2.
**Verdict: REJECT as a blueprint. ADOPT one lesson: it ships as a web/phone
service, not a desktop extension — distribution tools must live where the
user actually is. Scout (Telegram, phone) already embodies this.**

## R-5. Existing product landscape
Reply-focused tools that survived the Feb 2026 restriction pivoted to exactly
Scout's shape: surface + draft, human posts ([fireply.ai](https://fireply.ai/blog/x-api-reply-restriction-2026)).
**Verdict: the compliant category converged on the architecture Pedro already
built. That's independent validation of the design — and a warning that
productizing later means entering an existing category, where Pedro's
differentiator would be his own measured results (D1 data), not features.**
