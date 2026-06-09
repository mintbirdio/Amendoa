# Amendoa Scout

Phone-native reply radar. Scout watches an X List you already curate, scores every
fresh original post with the **same Opportunity Score engine as the desktop
extension**, and pushes the high-value, low-competition ones to your iPhone. Tap the
notification → it deep-links into the X app on the tweet → you reply early, by hand.

See [`../AMENDOA-SCOUT.md`](../AMENDOA-SCOUT.md) for the full product brief, the 2026
research, and the architecture rationale.

## How it works

```
X List timeline → ScraperSource → scoreTweet (shared brain) → threshold + dedup
                                                              → PushoverNotifier → 📱
```

Every piece is behind an interface so it's swappable and testable:

| Seam | v0 implementation | Swap later |
|------|-------------------|------------|
| `TweetSource` | `ScraperSource` (twitterapi.io shape) | `OfficialXSource` (List Tweets lookup) |
| `Notifier` | `PushoverNotifier` | Telegram / web-push |
| `AlertStore` | `FileAlertStore` (JSON + CI cache) | KV store |

The scoring brain is **not forked** — it lives in [`../src/shared/scoring.ts`](../src/shared/scoring.ts)
and is imported by both the extension and Scout.

## Local development

```bash
cd scout
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest — 55 tests, all mocked (no API keys needed)
```

## Going live (the only two secrets you provide)

1. **Scraper key** — sign up at your scraper provider (e.g. twitterapi.io) → `SCRAPER_API_KEY`.
   ⚠️ Confirm the endpoint paths / JSON field names in `src/sources/ScraperSource.ts`
   against the provider's live docs; `mapRawTweet` is defensive but the exact schema
   is the one thing a real key is needed to verify.
2. **Pushover** — buy the iOS app ($4.99 once), create an app token → `PUSHOVER_TOKEN`,
   and grab your user key → `PUSHOVER_USER`.

Then pick what to watch:
- **`WATCH_LIST_ID`** — the id from an X List URL `x.com/i/lists/<ID>` (preferred), or
- **`WATCH_USER_ID`** — your numeric user id, to watch your Following feed.

### Run once locally

```bash
SCRAPER_API_KEY=... PUSHOVER_TOKEN=... PUSHOVER_USER=... WATCH_LIST_ID=... npm start
```

### Run on a schedule (free)

The included GitHub Actions workflow ([`.github/workflows/scout.yml`](../.github/workflows/scout.yml))
polls every 5 minutes. Add the three secrets under **Settings → Secrets → Actions**
and `WATCH_LIST_ID` under **Settings → Variables → Actions**. Dedup state persists
between runs via the Actions cache.

## Tuning

| Env var | Default | Effect |
|---------|---------|--------|
| `MIN_SCORE` | `70` | Higher = fewer, hotter alerts |
| `FRESHNESS_MINUTES` | `60` | Ignore tweets older than this |
| `MAX_ALERTS_PER_RUN` | `10` | Anti-spam cap per poll |
| `DEDUP_RETENTION_DAYS` | `7` | How long a tweet stays "already alerted" |

Aim for ~10–30 quality pings/day. If it's noisy, raise `MIN_SCORE`; if it's quiet,
lower it or widen `FRESHNESS_MINUTES`.
