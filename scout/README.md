# Amendoa Scout

Phone-native reply radar. Scout watches the X accounts you care about, scores every
fresh original post with the **same Opportunity Score engine as the desktop
extension**, and pushes the high-value, low-competition ones to your iPhone. Tap the
notification → it deep-links into the X app on the tweet → you reply early, by hand.

See [`../AMENDOA-SCOUT.md`](../AMENDOA-SCOUT.md) for the full product brief, the 2026
research, and the first-principles cost analysis.

## How it works — push, not poll

The data path is the cheap part *if you let the data come to you*. A
[twitterapi.io filter rule](https://docs.twitterapi.io/api-reference/endpoint/add_webhook_rule)
(`(from:acct1 OR from:acct2 …) -filter:retweets -filter:replies`) pushes each watched
account's new original tweet to a tiny Cloudflare Worker — **once per tweet, no
re-scanning**. So cost tracks the new tweets you actually receive (~$1/mo) and alerts
land sub-second.

```
filter rule → webhook → Worker → scoreTweet (shared brain) → threshold + KV dedup
                                                            → Telegram/Pushover → 📱
```

Every piece is behind an interface, so it's swappable and testable:

| Seam | implementation | Swap later |
|------|-------------------|------------|
| ingest | webhook Worker (push) · `ScraperSource` List poll (pull fallback) | `OfficialXSource` |
| `Notifier` | `TelegramNotifier` (free) or `PushoverNotifier` | web-push |
| `AlertStore` | `KvAlertStore` (Cloudflare KV, push) · `FileAlertStore` (cron fallback) | — |

The scoring brain is **not forked** — it lives in [`../src/shared/scoring.ts`](../src/shared/scoring.ts)
and is imported by both the extension and Scout. `processBatch` (in `pipeline.ts`) is the
single score → threshold → dedup → notify authority shared by both ingest paths.

## Local development

```bash
cd scout
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest — 79 tests, all mocked (no API keys, no network)
```

## Going live (push mode, ~$1/mo, $0 infra)

You need a twitterapi.io key, a free notifier, and a free Cloudflare account.

1. **twitterapi.io key** → `SCRAPER_API_KEY`. This doubles as the webhook secret:
   twitterapi.io echoes it as `X-API-Key` on every push, and the Worker verifies it.
2. **A notifier** (Scout auto-detects, or set `NOTIFIER=telegram|pushover`):
   - **Telegram (free, recommended):** message [@BotFather](https://t.me/BotFather) → `/newbot`
     → `TELEGRAM_BOT_TOKEN`. Message your bot once, read your chat id from
     `https://api.telegram.org/bot<token>/getUpdates` → `TELEGRAM_CHAT_ID`. Alerts arrive
     with a tappable **Reply on X** button.
   - **Pushover ($4.99 once):** app token → `PUSHOVER_TOKEN`, user key → `PUSHOVER_USER`.
3. **Deploy the Worker** (see [`wrangler.toml`](wrangler.toml) for the exact commands):
   ```bash
   npx wrangler kv namespace create DEDUP_KV   # paste the id into wrangler.toml
   npx wrangler secret put SCRAPER_API_KEY
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_CHAT_ID
   npx wrangler deploy                         # prints your Worker URL
   ```
4. **Point the rule at the Worker:** paste the Worker URL into the twitterapi.io
   dashboard → **Filter Rules** → webhook destination.
5. **Register the accounts you watch:**
   ```bash
   SCRAPER_API_KEY=... WATCH_HANDLES="elonmusk, naval, paulg" npm run register-rule
   ```
   This packs your handles into the fewest 255-char rules, creates each, and activates
   them. Re-run any time your watch list changes.

That's it — new originals from those accounts now ping your phone in real time.

> **Why push beats a List poll.** Polling re-reads the same ~20 tweets every few
> minutes just to notice the new one — ~29× more reads than the irreducible "read each
> new tweet once" floor. Pushing a filter rule pays that floor (~$1/mo) *and* delivers
> sub-second instead of up-to-poll-interval late. See the Idiot Index analysis in the
> [brief](../AMENDOA-SCOUT.md).

## Fallback: cron poll of a single List

If you'd rather not run a Worker, the pull path still works: set `WATCH_LIST_ID` (the id
from `x.com/i/lists/<ID>`) and run `npm start`, or trigger the **poll** job in
[`.github/workflows/scout.yml`](../.github/workflows/scout.yml) via *workflow_dispatch*.
This costs ~$26/mo at 5-min cadence and tops out at poll-interval latency — fine for a
quick start, but push is strictly better once you're committed.

## Tuning

| Env var | Default | Effect |
|---------|---------|--------|
| `MIN_SCORE` | `70` | Higher = fewer, hotter alerts |
| `FRESHNESS_MINUTES` | `60` | Ignore tweets older than this |
| `MAX_ALERTS_PER_RUN` | `10` | Anti-spam cap per delivery |
| `DEDUP_RETENTION_DAYS` | `7` | How long a tweet stays "already alerted" (KV TTL) |

Aim for ~10–30 quality pings/day. If it's noisy, raise `MIN_SCORE`; if it's quiet,
lower it or add accounts to the rule. **Set a spend cap in the twitterapi.io dashboard** —
billing starts when a rule is active, regardless of whether your Worker is connected.
