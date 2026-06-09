# Amendoa Scout — Phone-Native Reply Radar (Product Brief + v0 Spec)

> **One-line:** Amendoa's desktop HUD makes you *browse* to find reply opportunities.
> Scout flips it: a cloud service **watches a big list of accounts for you and
> pings your iPhone** when a high-value tweet is fresh and uncrowded — you tap and
> reply early, by hand, in the X app.

This document captures the analysis, the 2026 research that gates the product, the
chosen architecture, and a concrete v0 build plan. It exists so the concept survives
between sessions and can be built against later.

---

## 1. Why a separate product (and not "the extension on a phone")

The desktop extension works by sitting inside the x.com browser tab and reading X's
GraphQL traffic as you scroll (`src/content/injector.ts`). That mechanism **cannot run
on iOS** — you can't extend the native X app, and iOS browsers won't load a
feed-reading extension. So a phone product must invert the model:

- **Desktop extension** = *pull*. You browse; it reads your live session for free.
- **Scout** = *push*. A cloud service polls chosen accounts and notifies you.

Constraints that shaped the design (from the owner): **iPhone-only, no PC ever**, a
**large watchlist (50–200+ accounts)** — replying to the same 10 accounts repeatedly
has no growth value — and it must be **cheap**.

---

## 2. The product loop

```
An X List you already curate ("Growth targets") OR your Following feed
  → cloud poller fetches its timeline's fresh ORIGINAL posts (every ~5 min)
  → scoreEngine.ts ranks each: reach × freshness × low-competition
  → when a post crosses HOT, push an alert to the iPhone
  → tap notification → X app opens on that tweet → reply early, by hand
```

Scout finds the *when* and *who*. You still write the reply (your voice = the value).
This is deliberately **notification-first**, not a feed to scroll — you won't browse a
HUD on a phone, but you *will* act on a well-timed ping.

---

## 3. The 2026 research that makes this viable

Five parallel research passes (cited below). The headline: **two things that would
have killed this a year ago both resolved in our favor in early 2026 — provided the
user replies manually.**

### 3.1 Cost flipped (Feb 2026) — pay-per-use
- X scrapped the fixed tiers (the old $200 Basic / **$5,000 Pro** wall) and made
  **pay-per-use** the default: **$0.005 per post read**, no subscription, no minimum.
- **24-hour deduplication**: re-reading the same tweet within a UTC day is billed once.
  → polling *frequency is effectively free*; cost is driven only by the count of
  **unique original posts** your watchlist produces.
- Source: <https://docs.x.com/x-api/getting-started/pricing>,
  <https://www.medianama.com/2026/02/223-x-developer-api-pricing-pay-per-use-model/>

### 3.2 Auto-reply is dead — manual reply is the compliant path
- As of ~Feb 23 2026, X **blocks programmatic replies** via the API unless the original
  author already mentioned/quoted you. The "tool posts your reply for you" design is
  non-viable.
- But **monitoring public accounts, scoring tweets, and pushing yourself a notification
  has no prohibiting clause.** You reply manually in the app — unaffected.
- Caveat: even *manual* high-volume reply sprees have triggered spam suspensions →
  favour **quality over volume** (which is already Amendoa's stated philosophy).
- Compliance to-dos: keep cached tweets current + purge deleted within 24h (store IDs,
  re-hydrate); render tweets unmodified with X branding + permalink.
- Sources: <https://docs.x.com/developer-terms/policy>,
  <https://docs.x.com/developer-terms/restricted-use-cases>,
  <https://docs.x.com/developer-terms/display-requirements>

### 3.3 Reaching the iPhone — no App Store app needed
- **Push:** most reliable cheap path is **Pushover** ($4.99 one-time, simple HTTP POST)
  or a **Telegram bot** (free). Both ride Apple's push via a polished app. A home-screen
  PWA can do web push (iOS 16.4+) but must be added to the home screen and has reported
  reliability quirks — fine for a later version, not v0.
- **Tap-to-reply link — ✅ VERIFIED (Jun 2026, physical iPhone):** the **plain permalink
  `https://x.com/<user>/status/<id>`** opens the **X app directly on the tweet** (one tap
  to reply) when tapped as a real link. A push-notification tap is the same iOS context as
  tapping a link in Messages, so this is the production path. **Use the bare permalink** —
  nothing fancier is needed or works better:
  - The web **intent** link (`intent/tweet?in_reply_to=`) is a dead end on iOS — it opens
    Safari into a **logged-out login wall**. Do not use.
  - The legacy **`twitter://` scheme** is not needed (and Notes/Safari won't even linkify it).
  - ⚠️ **Testing caveat for future-you:** Universal Links only fire from a *real link tap*
    (Messages, a notification). Pasting the URL into Safari's **address bar never triggers
    the app** — that always shows the logged-out web page. Don't mistake that for the link
    being broken.
- Sources: <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>,
  <https://docs.x.com/x-for-websites/web-intents/overview>, <https://pushover.net/api>

### 3.4 ✅ On-device verification — DONE (Jun 9 2026)
Tested on a physical iPhone:
- **Permalink → X app on the tweet: WORKS** (tapped from Messages). This is the flow.
- **Intent reply link: FAILS** (Safari login wall). Dropped from the design.
- **Address-bar / Notes-plaintext tests are invalid** and gave false negatives — see §3.3.

The tap flow is settled: **notification → tap permalink → tweet in X app → reply by hand.**

---

## 4. Cost & the data-source decision

Cost (official API) = unique original posts across the watchlist × $0.005:

| Watchlist | Official API $/mo | Scraper $/mo (~$0.00015/read) |
|-----------|-------------------|-------------------------------|
| 50        | ~$30–60           | ~$1–2                         |
| 100       | ~$60–120          | ~$2–4                         |
| 200       | ~$120–240         | ~$3–6                         |

Because the watchlist must be large **and** cheap, and there's no PC to run the free
extension, **v0 uses a scraper data source** (e.g. twitterapi.io, ~33× cheaper than
official). **Decision: "scraper now, swap later."**

- **Honest caveat:** a scraper gets data by scraping X, against X's ToS. For a *private*
  tool that only you run, only watches **public** accounts, and only pushes to
  **yourself**, the practical risk is low and falls on you. **Not distributable/sellable
  on that data source** — to productize, switch users to the official API and price to
  cover ~$60–120/mo.
- The architecture (§5) isolates this behind one interface so the swap is a one-file
  change.

All-in v0 cost: **GitHub Actions cron (free) + scraper (~$3–5/mo) + Pushover ($4.99
once) ≈ ~$5/month.**

---

## 5. Architecture — swappable data layer is the whole point

```
            ┌──────────────────────────────────────────────┐
            │  Scheduler (GitHub Actions cron, every 5 min) │
            └───────────────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │        DataSource (iface)      │   ← swap point
                    │  fetchRecentOriginals(handles) │
                    ├────────────────────────────────┤
                    │ ScraperSource   (v0, ~$5/mo)   │
                    │ OfficialXSource (later, compliant) │
                    └───────────────┬────────────────┘
                                    │ TweetData[]
                    ┌───────────────▼───────────────┐
                    │  scoreEngine.ts  (REUSED AS-IS)│
                    │  reach × freshness × competition│
                    └───────────────┬────────────────┘
                                    │ scored, deduped vs "already alerted" store
                    ┌───────────────▼───────────────┐
                    │  Notifier (iface)              │
                    │  Pushover | Telegram           │
                    └───────────────┬────────────────┘
                                    │ alert + permalink / reply-intent link
                                 📱 iPhone
```

### The one interface that makes "swap later" true

```ts
// The ONLY thing that changes when you move scraper → official API.
export interface TweetSource {
  /** Fresh original posts (no replies/retweets) from a source's timeline, newest first.
   *  source = an X List id ("list:1234...") or the Following feed ("following").
   *  No per-account fan-out: one fetch returns the whole curated timeline. */
  fetchRecentOriginals(source: WatchSource, sinceMinutes: number): Promise<TweetData[]>;
}

type WatchSource =
  | { kind: "list"; listId: string }      // GET /2/lists/:id/tweets
  | { kind: "following"; userId: string }; // GET /2/users/:id/timelines/reverse_chronological

// TweetData is ALREADY defined in src/services/scoreEngine.ts — reuse it verbatim:
//   tweetId, authorHandle, postedAt, likes, retweets, replies, views,
//   isReply, isThread, authorFollowerCount?, authorIsPremium?

class ScraperSource implements TweetSource { /* v0: cheap scraper, list/following timeline */ }
class OfficialXSource implements TweetSource { /* later: List Tweets lookup /
                                                  reverse_chronological timeline */ }
```

`scoreEngine.ts` is **already pure TypeScript** — only two helpers touch the browser DB
(`calculateRiskPenalty`, `calculateOpportunityScore` do a Dexie lookup). For Scout,
replace that lookup with a server store (or pass `target = null`, which the engine
already handles for Discovery-mode scoring). **The scoring brain ships unchanged.**

### Dedup / "don't alert twice"
Keep a small persisted set of alerted tweet IDs (e.g. a JSON file committed by the
Action, or a free KV store). Only push a tweet once, and only if it crosses the HOT
threshold within its freshness window.

---

## 6. v0 build plan (milestones)

- [x] **M0 — On-device check.** ✅ Done (§3.4): permalink deep-links into the X app; intent
      link is dead. Tap flow settled.
- [ ] **M1 — Data adapter.** `ScraperSource implements TweetSource`; read one **X List
      timeline** by id, map JSON → `TweetData`. Log scored output. (Local run.)
- [ ] **M2 — Scoring reuse.** Import `scoreEngine.ts`; run `calculateOpportunityScore`
      server-side with `target = null`; confirm HOT/HIGH badges look right.
- [ ] **M3 — Notifier.** `PushoverNotifier` (or Telegram); send one alert whose tap URL is
      the **bare permalink** `https://x.com/<user>/status/<id>`. Confirm tap → tweet in app.
- [ ] **M4 — Dedup + threshold.** Persist alerted IDs; only push HOT, once.
- [ ] **M5 — Scheduler.** GitHub Actions cron every 5 min; the watched **List ID** (one
      value) + secrets (scraper key, Pushover token) in repo secrets/vars.
- [ ] **M6 — Tune.** Adjust HOT threshold + freshness window so you get ~10–30
      high-quality pings/day, not noise.

### Watchlist management (v0) — don't build one, reuse X's
**First principle: nobody wants to build a watchlist from scratch.** X Lists already
*are* curated watchlists. Make one List in the X app called "Growth targets," and Scout
reads its timeline directly via the List id (found in the list's URL,
`x.com/i/lists/<ID>`). You curate it natively on your phone; Scout needs only that one
id. No `watchlist.json`, no per-account fan-out, no separate UI — ever. (Following feed
works too via the reverse-chronological timeline endpoint, but a dedicated List keeps
growth targets separate from the noise of who you follow personally.)

---

## 7. Risks to keep in view
- **Platform risk is the real cost.** X has re-priced 3× since 2023 and killed access
  overnight before (Feb 2023). Set spending caps; never let the architecture die if the
  data source vanishes or triples in price — that's exactly why the `TweetSource`
  seam exists.
- **Account health.** Scout encourages *early, targeted, hand-written* replies — keep it
  quality-first; high-volume reply sprees risk spam flags on your own account.
- **Scraper fragility / ToS.** Personal use only on the scraper path; productizing
  requires the official-API adapter.

---

## 8. Sources (research, June 2026)
- X API pricing (official): <https://docs.x.com/x-api/getting-started/pricing>
- Pay-per-use launch: <https://www.medianama.com/2026/02/223-x-developer-api-pricing-pay-per-use-model/>
- Developer policy / restricted use / display: <https://docs.x.com/developer-terms/policy> ·
  <https://docs.x.com/developer-terms/restricted-use-cases> ·
  <https://docs.x.com/developer-terms/display-requirements>
- Programmatic-reply restriction (Feb 2026): <https://piunikaweb.com/2026/02/24/x-api-blocks-automated-spam-replies/>
- iOS web push: <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>
- Pushover API/pricing: <https://pushover.net/api> · <https://pushover.net/pricing>
- X web intents (reply link): <https://docs.x.com/x-for-websites/web-intents/overview>
- Indie cost analysis: <https://superframeworks.com/articles/x-api-pay-per-use-pricing-indie-hackers>
</content>
</invoke>
