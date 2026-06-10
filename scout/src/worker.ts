/**
 * Scout Worker — the Cloudflare runtime that ties the app together.
 *
 *  • scheduled(): the poll cycle. Reads the watched List via the official X API,
 *    scores, dedups (KV), alerts to Telegram (with cockpit buttons), and records
 *    the proof data (D1). Runs on a Cron Trigger; 24h read-dedup keeps it cheap.
 *  • fetch(): the Telegram cockpit webhook (/telegram) — verifies the secret,
 *    then dispatches button taps (Draft / Used it / Skip) to TelegramCockpit.
 *
 * Everything below is Worker-safe (fetch + KV + D1 only — no node: imports).
 */

import {
    resolveDataSource, resolveWatch, resolveNotifier, resolveConfig, ConfigError
} from './config';
import type { TweetSource } from './sources/TweetSource';
import { OfficialXSource } from './sources/OfficialXSource';
import { ScraperSource } from './sources/ScraperSource';
import { buildCredentialProvider } from './sources/Credentials';
import { KvAlertStore, type KvLike } from './store/KvAlertStore';
import { D1MeasurementStore, type D1Like } from './measure/D1MeasurementStore';
import { MeasurementRecorder } from './measure/AlertRecorder';
import { buildNotifier } from './notify/factory';
import { TelegramCockpit } from './notify/TelegramCockpit';
import { DraftService } from './voice/DraftService';
import { D1VoiceStore } from './voice/VoiceStore';
import { DEFAULT_GUARDRAILS } from './voice/types';
import { AnthropicLlmClient } from './llm/AnthropicLlmClient';
import type { LlmClient } from './llm/LlmClient';
import { processBatch } from './pipeline';
import { XOwnedReads } from './xapi/OwnedReads';
import { runSweep } from './measure/Sweep';
import type { CredentialProvider } from './sources/Credentials';

export interface WorkerBindings {
    // secrets / vars
    DATA_SOURCE?: string;
    X_BEARER_TOKEN?: string;
    X_CLIENT_ID?: string;
    X_REFRESH_TOKEN?: string;
    X_CLIENT_SECRET?: string;
    SCRAPER_API_KEY?: string;
    SCRAPER_BASE_URL?: string;
    WATCH_LIST_ID?: string;
    NOTIFIER?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    PUSHOVER_TOKEN?: string;
    PUSHOVER_USER?: string;
    ANTHROPIC_API_KEY?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    MIN_SCORE?: string;
    FRESHNESS_MINUTES?: string;
    MAX_ALERTS_PER_RUN?: string;
    DEDUP_RETENTION_DAYS?: string;
    // bindings
    DEDUP_KV: KvLike;
    DB: D1Like;
}

type EnvRecord = Record<string, string | undefined>;
const REFRESH_KEY = 'x_refresh_token';
const SWEEP_CRON = '0 9 * * *';   // daily learning + outcome pass

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve the official X credential provider; persist rotated refresh tokens to KV. */
async function buildCredential(env: WorkerBindings): Promise<CredentialProvider> {
    const ds = resolveDataSource(env as unknown as EnvRecord);
    if (ds.kind !== 'official') throw new ConfigError('owned reads require DATA_SOURCE=official');
    let credential = ds.credential;
    if (credential.mode === 'oauth') {
        const stored = await env.DEDUP_KV.get(REFRESH_KEY);
        if (stored) credential = { ...credential, refreshToken: stored };
    }
    return buildCredentialProvider(credential, { onRefresh: (t) => env.DEDUP_KV.put(REFRESH_KEY, t) });
}

/** Build the data source. */
async function buildSource(env: WorkerBindings): Promise<TweetSource> {
    const ds = resolveDataSource(env as unknown as EnvRecord);
    if (ds.kind === 'scraper') {
        return new ScraperSource({ apiKey: ds.apiKey, baseUrl: ds.baseUrl });
    }
    return new OfficialXSource({ credentials: await buildCredential(env) });
}

function buildCockpit(env: WorkerBindings): TelegramCockpit {
    const store = new D1MeasurementStore(env.DB);
    const client: LlmClient = env.ANTHROPIC_API_KEY
        ? new AnthropicLlmClient({ apiKey: env.ANTHROPIC_API_KEY })
        : { async draftReplies() { return []; } }; // drafting not configured → graceful no-op
    const draftService = new DraftService({
        alerts: store,
        voice: new D1VoiceStore(env.DB),
        client,
        guardrails: DEFAULT_GUARDRAILS
    });
    return new TelegramCockpit({ botToken: env.TELEGRAM_BOT_TOKEN ?? '', draftService, store });
}

export default {
    /** Cron Triggers: the frequent poll, and a daily learning/outcome sweep. */
    async scheduled(event: { cron?: string }, env: WorkerBindings): Promise<void> {
        if (event?.cron === SWEEP_CRON) {
            const res = await runSweep({
                reads: new XOwnedReads({ credentials: await buildCredential(env) }),
                store: new D1MeasurementStore(env.DB),
                voice: new D1VoiceStore(env.DB)
            });
            console.log(`[scout] sweep done: ${JSON.stringify(res)}`);
            return;
        }

        const cfg = resolveConfig(env as unknown as EnvRecord);
        const watch = resolveWatch(env as unknown as EnvRecord);
        const notifier = buildNotifier(resolveNotifier(env as unknown as EnvRecord));
        const source = await buildSource(env);

        const fetched = await source.fetchRecentOriginals(watch, cfg.freshnessMinutes);
        const store = await KvAlertStore.load(env.DEDUP_KV, fetched.map(t => t.data.tweetId), cfg.dedupRetentionMs);
        const recorder = new MeasurementRecorder(new D1MeasurementStore(env.DB), 'poll');

        const summary = await processBatch(
            fetched,
            { notifier, store, recorder, config: cfg, log: (m) => console.log(`[scout] ${m}`) },
            Date.now()
        );
        console.log(`[scout] poll done: ${JSON.stringify({ fetched: summary.fetched, alerted: summary.alerted, deduped: summary.deduped })}`);
    },

    /** Telegram cockpit webhook + health. */
    async fetch(request: Request, env: WorkerBindings): Promise<Response> {
        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true });

        if (request.method === 'POST' && url.pathname === '/telegram') {
            const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
            if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
                return json({ error: 'unauthorized' }, 401);
            }
            let update: unknown;
            try { update = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
            try {
                const result = await buildCockpit(env).handleUpdate(update as never);
                return json({ ok: true, ...result });
            } catch (err) {
                console.error('[scout] cockpit error:', err);
                // 200 so Telegram doesn't retry-loop on our internal error.
                return json({ ok: false, error: err instanceof Error ? err.message : 'error' }, 200);
            }
        }

        return json({ error: 'not found' }, 404);
    }
};

export { ConfigError };
