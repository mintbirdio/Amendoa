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
| `Notifier` | `TelegramNotifier` (free) or `PushoverNotifier` | web-push |
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

## Going live (the secrets you provide)

1. **Scraper key** — sign up at [twitterapi.io](https://twitterapi.io) → `SCRAPER_API_KEY`.
   The List Tweets endpoint and field names in `src/sources/ScraperSource.ts` were
   verified against twitterapi.io's 2026 docs; `mapRawTweet` stays defensive about
   field-name variants, so a live schema tweak is a one-line fix there.
2. **A notifier** — pick one (Scout auto-detects, or set `NOTIFIER=telegram|pushover`):
   - **Telegram (free, recommended):** message [@BotFather](https://t.me/BotFather) → `/newbot`
     → copy the bot token → `TELEGRAM_BOT_TOKEN`. Then message your new bot once and read
     your chat id from `https://api.telegram.org/bot<token>/getUpdates` (`message.chat.id`)
     → `TELEGRAM_CHAT_ID`. Alerts arrive with a tappable **Reply on X** button.
   - **Pushover ($4.99 once):** buy the iOS app, create an app token → `PUSHOVER_TOKEN`,
     grab your user key → `PUSHOVER_USER`. The $4.99 is Pushover's one-time license fee.

Then set what to watch:
- **`WATCH_LIST_ID`** — the id from an X List URL `x.com/i/lists/<ID>`.

> **Why a List, not your Following feed?** A List is one endpoint call (cheap,
> O(1) per poll). There's no aggregated following-timeline endpoint on the
> scraper, and the official API bills timeline reads at $0.005 each — so a true
> following feed means per-account fan-out whose cost scales with how many
> people you follow. Mirror the accounts you care about into a List instead.

### Run once locally

```bash
SCRAPER_API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... WATCH_LIST_ID=... npm start
```

### Run on a schedule (free)

The included GitHub Actions workflow ([`.github/workflows/scout.yml`](../.github/workflows/scout.yml))
polls every 5 minutes. Add `SCRAPER_API_KEY` + your notifier secrets
(`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, or `PUSHOVER_TOKEN`/`PUSHOVER_USER`) under
**Settings → Secrets → Actions**, and `WATCH_LIST_ID` under **Settings → Variables →
Actions**. Dedup state persists between runs via the Actions cache.

## Tuning

| Env var | Default | Effect |
|---------|---------|--------|
| `MIN_SCORE` | `70` | Higher = fewer, hotter alerts |
| `FRESHNESS_MINUTES` | `60` | Ignore tweets older than this |
| `MAX_ALERTS_PER_RUN` | `10` | Anti-spam cap per poll |
| `DEDUP_RETENTION_DAYS` | `7` | How long a tweet stays "already alerted" |

Aim for ~10–30 quality pings/day. If it's noisy, raise `MIN_SCORE`; if it's quiet,
lower it or widen `FRESHNESS_MINUTES`.
