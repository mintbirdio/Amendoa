# Amendoa Scout

Phone-native reply radar + voice-matched draft assistant. Scout watches the X accounts
you care about, scores every fresh original post with the **same Opportunity Score
engine as the desktop extension**, pushes the high-value, low-competition ones to your
phone via Telegram, and — on demand — drafts a reply **in your voice** with Claude
Opus that you review and post by hand. It records every alert → reply → outcome so you
can prove (or kill) the growth hypothesis with data.

See [`../AMENDOA-SCOUT.md`](../AMENDOA-SCOUT.md) for the product brief, the 2026 research,
the provider analysis (why the official X API), and the first-principles cost work.

## How it works

```
Cron (Cloudflare Worker, every ~1 min)
  → OfficialXSource reads your X List's fresh originals (official API; 24h read-dedup ≈ free)
  → scoreTweet (shared brain): reach × freshness × low-competition
  → ≥ MIN_SCORE & fresh & not already alerted (KV dedup)
  → Telegram alert with buttons: [Reply on X] [✍️ Draft] [👎 Skip]
        tap Draft → Opus 4.8 drafts replies in your voice → [✅ Used it] [🔁 Regenerate] [👎 Skip]
  → every alert/action/outcome recorded to D1 (the proof data)
```

Manual replies only — X blocks programmatic replies (Feb 2026), and monitoring +
drafting-for-a-human is the compliant path. Scout never posts for you.

### Architecture (every seam is swappable + tested)

| Seam | Implementation | Swap path |
|------|----------------|-----------|
| `TweetSource` | `OfficialXSource` (official X API) · `ScraperSource` (cheap fallback) | shared `mapTweet` mapper |
| `CredentialProvider` | `RefreshingCredentialProvider` (owner OAuth) | per-user BYO key → shared pool |
| `Notifier` | `TelegramNotifier` (cockpit buttons) · `PushoverNotifier` | — |
| `AlertStore` | `KvAlertStore` (Worker) · `FileAlertStore` (local) | — |
| `MeasurementStore` | `D1MeasurementStore` · `InMemoryMeasurementStore` | — |
| `LlmClient` | `AnthropicLlmClient` (Opus 4.8) | — |

The scoring brain is **not forked** — it lives in [`../src/shared/scoring.ts`](../src/shared/scoring.ts)
and is imported by both the extension and Scout.

## Local development

```bash
cd scout
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest — 134 tests, fully mocked (no keys, no network)
```

## Going live (≈20 min — then it just runs)

You provide three API credentials; Scout wires the rest.

**1. X API (official, pay-per-use).** Create a developer app at developer.x.com with
**OAuth 2.0** enabled (type Native/Public; add `http://127.0.0.1/callback` as a callback).
Then mint a refresh token:
```bash
X_CLIENT_ID=<your-client-id> npm run x-auth      # click Authorize once, paste the redirect back
```
It prints `X_CLIENT_ID` + `X_REFRESH_TOKEN`.

**2. Telegram (free).** Message [@BotFather](https://t.me/BotFather) → `/newbot` → bot token.
Message your new bot once, then read your chat id from
`https://api.telegram.org/bot<token>/getUpdates` (`message.chat.id`).

**3. Anthropic.** Get a key at console.anthropic.com (for the Draft button).

**4. Cloudflare resources + deploy:**
```bash
npx wrangler kv namespace create DEDUP_KV     # paste id → wrangler.toml
npx wrangler d1 create scout-db               # paste database_id → wrangler.toml
npm run db:init                               # create D1 tables (migrations/0001_init.sql)

npx wrangler secret put X_CLIENT_ID
npx wrangler secret put X_REFRESH_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # any random string

# set WATCH_LIST_ID (the id in x.com/i/lists/<ID>) as a var or secret
npx wrangler deploy
```

**5. Point Telegram at the cockpit** (one curl, using the same secret):
```bash
curl "https://api.telegram.org/bot<token>/setWebhook" \
  -d "url=https://<your-worker-url>/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Done. The cron polls your List every minute, alerts fire to Telegram with a Draft
button, and the proof data accumulates in D1.

## Tuning

| Var | Default | Effect |
|-----|---------|--------|
| `MIN_SCORE` | `70` | Higher = fewer, hotter alerts |
| `FRESHNESS_MINUTES` | `60` | Ignore tweets older than this |
| `MAX_ALERTS_PER_RUN` | `10` | Anti-spam cap per poll |
| `DEDUP_RETENTION_DAYS` | `7` | How long a tweet stays "already alerted" (KV TTL) |

Aim for ~10–30 quality pings/day. **Set a spend cap in the X developer console** —
at one user the official API is a few dollars/month (your watchlist reads at $0.005,
deduped daily; your own replies at the $0.001 owned rate).

## Cost (personal, one user)

X API reads ~$10–30/mo depending on List size · Anthropic ~$1–5/mo (on-demand drafts,
cached voice prefix) · Cloudflare + Telegram free. **~$15–35/mo all-in** for a legit,
zero-ban-risk, fully-instrumented tool.
