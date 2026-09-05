# CLAIMS — Amendoa revamp investigation (2026-08-31)

## The problem
Pedro wants X distribution: grow his personal following into an engine for
Mintbird-as-media-company. Amendoa (reply-opportunity scoring) is the asset he
believes can drive it. Supabird.io reignited the itch, but he distrusts
AI-slop auto-posting.

## The single decision this serves
**Is the strategic-reply loop (Scout alerts → Pedro replies from his phone)
worth building on — yes or no?** Everything else (more features, productizing,
leaving the extension) is downstream of this answer.

## Facts (evidence cited)
- F1. Amendoa v1 is a finished local-only Chrome extension: opportunity
  scoring HUD + gamification, no backend, no AI. (AMENDOA.md)
- F2. Amendoa Scout is a finished, tested (134 vitest tests), deploy-ready
  Cloudflare Worker: official X API List polling → shared scoring engine →
  Telegram alerts → Claude draft-in-voice → D1 measurement log.
  (scout/README.md, scout/ source)
- F3. Scout was costed first-principles at ~$15–35/mo all-in for one user,
  with an X-console spend cap as the safety. (scout/README.md, AMENDOA-SCOUT.md)
- F4. X blocked programmatic replies in Feb 2026; monitoring + human-posted
  drafts is the compliant path. (scout/README.md — reverify in Phase 2)
- F5. Supabird = $39-lifetime/$99-yr web app: AI post ideas, viral-template
  rewrites, engage suggestions, cross-posting (X/Threads/LinkedIn/Bluesky).
  Content-generation-first; engagement is a bolt-on. (supabird.io, 2026-08-31)
- F6. **Neither Amendoa v1 nor Scout was ever used in anger. The growth
  hypothesis has zero real-world data.** (Pedro, interview)
- F7. Deploy blockers were X-API signup/cost fear + setup friction — both
  conventional, neither fundamental. (Pedro, interview)
- F8. Objective: dogfood first, productize only if Pedro's own growth
  validates it. (Pedro, interview)
- F9. Realistic commitment: ~15 min/day on the phone, 5–10 quality replies.
  (Pedro, interview)
- F10. Growth target: Pedro's personal account. (Pedro, interview)

## Assumptions (unproven, must be tested or verified)
- A1. Strategic early replies to mid/large accounts still convert to
  followers in the 2026 X algorithm. (The core hypothesis. Untested — F6.)
- A2. Scout's cost model (F3) still matches current X API pricing.
- A3. 5–10 replies/day for 30 days is enough volume to see a signal above
  noise on a personal account.
- A4. Claude-drafted replies in Pedro's voice are good enough that the
  15-min/day budget holds.
- A5. Supabird's "10x growth" claims reflect real user outcomes rather than
  marketing. (Low confidence; not load-bearing either way.)

## Explicitly rejected (with reason)
- R1. "Post on my behalf" automation — Pedro distrusts it, AI-slop saturation
  is real, and F4 says X blocks it anyway.
- R2. "Revamp with more features" as the next step — features on an unmeasured
  loop is optimizing something that may not work (violates delete-before-
  optimize; F6).
