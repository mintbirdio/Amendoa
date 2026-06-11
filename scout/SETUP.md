# Scout setup — step by step (for beginners)

Goal: get five things (X, Telegram, Anthropic, a List id, a made-up secret),
then hand them to Cloudflare and deploy. ~20–30 minutes. Do the steps in order.

You'll collect these values as you go — keep them in a scratch note:

| Value | From step |
|---|---|
| `X_CLIENT_ID`, `X_REFRESH_TOKEN` | 1 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` | 2 |
| `ANTHROPIC_API_KEY` | 3 |
| `WATCH_LIST_ID` | 4 |

---

## 0. Prerequisites (once)

1. Install **Node.js** (nodejs.org, the LTS version).
2. Open a terminal in the `scout/` folder of this repo and run:
   ```bash
   npm install
   ```

---

## 1. X (Twitter) API → `X_CLIENT_ID` + `X_REFRESH_TOKEN`

1. Go to **developer.x.com** → sign in → apply for a developer account if you
   don't have one (the free/pay-per-use default is fine).
2. Create a **Project**, then an **App** inside it.
3. Open your App → **User authentication settings** → **Set up**:
   - **App permissions:** Read
   - **Type of App:** *Native App* (a "public client" — no secret needed)
   - **Callback URI / Redirect URL:** `http://127.0.0.1/callback`
   - **Website URL:** anything (e.g. your X profile link)
   - **Save**.
4. Open **Keys and tokens** → under **OAuth 2.0 Client ID and Client Secret**,
   copy the **Client ID**. (Only copy the Client Secret if you chose a
   "Confidential"/Web App instead of Native.)
5. Back in your terminal (in `scout/`), mint the refresh token:
   ```bash
   X_CLIENT_ID=PASTE_YOUR_CLIENT_ID npm run x-auth
   ```
   - It prints a long URL. **Open it in your browser** and click **Authorize**.
   - Your browser will try to open `http://127.0.0.1/callback?...` and show
     "this site can't be reached" — **that's expected**. Copy the **entire URL**
     from the browser's address bar.
   - **Paste that URL back into the terminal** and press Enter.
   - It prints `X_CLIENT_ID=...` and `X_REFRESH_TOKEN=...`. **Save both.**
6. In the developer console, set a **spending limit** (billing) so usage can't
   surprise you. At one user this is a few dollars/month.

---

## 2. Telegram → bot token, chat id, and a webhook secret

1. In the Telegram app, search for **@BotFather** → start it → send `/newbot`.
   Follow the prompts (a name, then a username ending in `bot`). It replies with
   a **bot token** like `8123456789:AAH...`. **Copy it** → that's
   `TELEGRAM_BOT_TOKEN`.
2. Tap your new bot, **send it any message** (e.g. "hi"). (This is required so it
   can find your chat.)
3. In a browser, open (paste your token in):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
   Find `"chat":{"id":123456789,...}`. That number is your `TELEGRAM_CHAT_ID`.
4. Make up a **random secret string** for `TELEGRAM_WEBHOOK_SECRET` — e.g. run
   `openssl rand -hex 16`, or just type ~20 random characters. Save it.

---

## 3. Anthropic → `ANTHROPIC_API_KEY`

1. Go to **console.anthropic.com** → sign in.
2. Add a little billing credit (Settings → Billing).
3. **API Keys** → **Create Key** → copy it (starts with `sk-ant-...`). Save it.

---

## 4. Your watch List → `WATCH_LIST_ID`

1. On X (x.com), create a **List** of the accounts you want to watch (or use an
   existing one). Lists live under your profile → **Lists**.
2. Open the List. Its URL looks like `x.com/i/lists/1700000000000000000`.
   The long number is your `WATCH_LIST_ID`.

---

## 5. Cloudflare → create the resources

1. Log in to Cloudflare from the terminal (opens a browser to authorize):
   ```bash
   npx wrangler login
   ```
2. Create the dedup store (KV):
   ```bash
   npx wrangler kv namespace create DEDUP_KV
   ```
   It prints an `id = "..."`. **Open `wrangler.toml`** and replace
   `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with it.
3. Create the database (D1):
   ```bash
   npx wrangler d1 create scout-db
   ```
   It prints a `database_id = "..."`. Put it in `wrangler.toml` in place of
   `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Create the tables:
   ```bash
   npm run db:init
   ```

---

## 6. Put the secrets into Cloudflare

Run each line below; it will **prompt you to paste the value**, then store it
encrypted (never in a file):

```bash
npx wrangler secret put X_CLIENT_ID
npx wrangler secret put X_REFRESH_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put WATCH_LIST_ID
```

(Only if you used a *Confidential* X app in step 1, also run
`npx wrangler secret put X_CLIENT_SECRET`.)

---

## 7. Deploy

```bash
npx wrangler deploy
```

It prints your Worker URL, e.g. `https://amendoa-scout.YOURNAME.workers.dev`.
**Copy that URL.**

---

## 8. Connect Telegram to the Worker

Run this once (fill in your bot token, your Worker URL, and the **same**
`TELEGRAM_WEBHOOK_SECRET` from step 2):

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -d "url=https://amendoa-scout.YOURNAME.workers.dev/telegram" \
  -d "secret_token=YOUR_TELEGRAM_WEBHOOK_SECRET"
```

It should reply `{"ok":true,...}`.

---

## 9. Check it works

1. Open `https://amendoa-scout.YOURNAME.workers.dev/health` in a browser — it
   should show `{"ok":true}`.
2. Within ~1 minute the cron runs. When a watched account posts a fresh,
   high-scoring tweet, you'll get a **Telegram alert** with buttons. Tap
   **✍️ Draft** to test the Opus reply, then **✅ Used it** after you reply.
3. If it's too quiet or too noisy, edit `MIN_SCORE` in `wrangler.toml` and
   `npx wrangler deploy` again.

Done. The cron polls every minute and a daily sweep (09:00 UTC) records outcomes
and learns your voice.

---

### Updating a secret later
Just run `npx wrangler secret put NAME` again with the new value, then
`npx wrangler deploy`. To see what's set: `npx wrangler secret list`.

### Want to test locally first?
`cp .dev.vars.example .dev.vars`, fill it in, then `npx wrangler dev`. The
`.dev.vars` file is git-ignored so it stays private.
