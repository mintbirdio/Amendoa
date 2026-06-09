/**
 * Scout webhook Worker — the push-mode entry point (Cloudflare Workers).
 *
 * A twitterapi.io filter rule POSTs each matching new tweet to this Worker; we
 * verify it, score it through the SAME pipeline the cron path uses, dedup via
 * KV, and push a phone alert. No polling → cost tracks real new tweets (~$1/mo)
 * and alerts land sub-second instead of up to a poll-interval late.
 *
 * Auth: twitterapi.io echoes our own API key as `X-API-Key` on every push, so we
 * check it against SCRAPER_API_KEY (a shared secret). Set the destination URL of
 * this Worker in the twitterapi.io dashboard's Filter Rules section.
 */

import { loadWorkerConfig, ConfigError } from './config';
import { buildNotifier } from './notify/factory';
import { KvAlertStore, type KvLike } from './store/KvAlertStore';
import { parseWebhookTweets } from './webhook/payload';
import { processBatch } from './pipeline';

/** Bindings the Worker expects (vars/secrets are strings; DEDUP_KV is a KV namespace). */
export interface WorkerBindings {
    SCRAPER_API_KEY: string;
    NOTIFIER?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    PUSHOVER_TOKEN?: string;
    PUSHOVER_USER?: string;
    MIN_SCORE?: string;
    FRESHNESS_MINUTES?: string;
    MAX_ALERTS_PER_RUN?: string;
    DEDUP_RETENTION_DAYS?: string;
    DEDUP_KV: KvLike;
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export default {
    async fetch(request: Request, env: WorkerBindings): Promise<Response> {
        if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

        let cfg;
        try {
            cfg = loadWorkerConfig(env as unknown as Record<string, string | undefined>);
        } catch (err) {
            const msg = err instanceof ConfigError ? err.message : 'config error';
            return json({ error: msg }, 500);
        }

        // Verify the shared secret echoed by twitterapi.io on every push.
        const key = request.headers.get('X-API-Key');
        if (!key || key !== cfg.webhookSecret) return json({ error: 'unauthorized' }, 401);

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'invalid json' }, 400);
        }

        const tweets = parseWebhookTweets(body);
        const ids = tweets.map(t => t.data.tweetId);

        try {
            const store = await KvAlertStore.load(env.DEDUP_KV, ids, cfg.config.dedupRetentionMs);
            const notifier = buildNotifier(cfg.notifier);
            const summary = await processBatch(tweets, { notifier, store, config: cfg.config }, Date.now());
            return json({
                ok: true,
                received: tweets.length,
                alerted: summary.alerted,
                deduped: summary.deduped
            });
        } catch (err) {
            // Already-sent alerts were persisted (processBatch flushes in finally),
            // so a 500 → provider retry is dedup-safe and recovers the rest.
            const msg = err instanceof Error ? err.message : 'processing error';
            return json({ error: msg }, 500);
        }
    }
};
