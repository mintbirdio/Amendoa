/**
 * Environment-driven configuration.
 *
 * Default data source is the OFFICIAL X API (legit, pay-per-use). To go live you
 * provide X API credentials, ONE notifier, and a watch target:
 *
 *   DATA_SOURCE       — "official" (default) | "scraper"
 *   Official X API auth (one of):
 *     X_BEARER_TOKEN                       — a ready bearer (e.g. from the OAuth helper), OR
 *     X_CLIENT_ID + X_REFRESH_TOKEN        — auto-refreshed user-context token (+ X_CLIENT_SECRET if confidential)
 *   NOTIFIER          — "telegram" | "pushover"  (optional; auto-detected)
 *     Telegram:  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *     Pushover:  PUSHOVER_TOKEN + PUSHOVER_USER
 *   WATCH_LIST_ID     — an X List id to watch (the id in x.com/i/lists/<ID>)
 *   ANTHROPIC_API_KEY — for on-demand voice-matched reply drafting (optional until used)
 *
 * Scraper mode (DATA_SOURCE=scraper, SCRAPER_API_KEY) is a cheap, unauthorized
 * fallback for throwaway personal use only — see sources/ScraperSource.ts.
 */

import type { ScoutConfig, WatchSource } from './types';
import { DEFAULT_CONFIG } from './types';

/** Which notifier to build, with its resolved credentials. */
export type NotifierConfig =
    | { kind: 'telegram'; botToken: string; chatId: string }
    | { kind: 'pushover'; token: string; user: string };

/** How to authenticate to the official X API. */
export type XCredentialConfig =
    | { mode: 'static'; bearerToken: string }
    | { mode: 'oauth'; clientId: string; refreshToken: string; clientSecret?: string };

/** Which data source the pipeline reads from. */
export type DataSourceConfig =
    | { kind: 'official'; credential: XCredentialConfig }
    | { kind: 'scraper'; apiKey: string; baseUrl?: string };

export interface ResolvedEnv {
    dataSource: DataSourceConfig;
    notifier: NotifierConfig;
    watch: WatchSource;
    config: ScoutConfig;
    statePath: string;
    /** Anthropic key for drafting; undefined until the drafting feature is used. */
    anthropicApiKey?: string;
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

function num(env: Env, key: string, fallback: number): number {
    const v = env[key];
    if (v === undefined || v.trim() === '') return fallback;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new ConfigError(`${key} must be a number, got "${v}"`);
    return n;
}

function req(env: Env, key: string): string {
    const v = env[key];
    if (!v || v.trim() === '') throw new ConfigError(`Missing required env var: ${key}`);
    return v.trim();
}

/** Resolve official X API credentials: a static bearer, or OAuth refresh creds. */
export function resolveXCredential(env: Env): XCredentialConfig {
    const bearer = env.X_BEARER_TOKEN?.trim();
    if (bearer) return { mode: 'static', bearerToken: bearer };

    const clientId = env.X_CLIENT_ID?.trim();
    const refreshToken = env.X_REFRESH_TOKEN?.trim();
    if (clientId && refreshToken) {
        return {
            mode: 'oauth',
            clientId,
            refreshToken,
            clientSecret: env.X_CLIENT_SECRET?.trim() || undefined
        };
    }
    throw new ConfigError(
        'Official X API needs X_BEARER_TOKEN, or X_CLIENT_ID + X_REFRESH_TOKEN (run `npm run x-auth` to mint them)'
    );
}

/** Resolve the data source — official X API by default, scraper if chosen. */
export function resolveDataSource(env: Env): DataSourceConfig {
    const kind = (env.DATA_SOURCE?.trim().toLowerCase() || 'official');
    if (kind === 'official') {
        return { kind: 'official', credential: resolveXCredential(env) };
    }
    if (kind === 'scraper') {
        return { kind: 'scraper', apiKey: req(env, 'SCRAPER_API_KEY'), baseUrl: env.SCRAPER_BASE_URL?.trim() || undefined };
    }
    throw new ConfigError(`DATA_SOURCE must be "official" or "scraper", got "${kind}"`);
}

/** Resolve the watch target from env. Scout watches an X List. */
export function resolveWatch(env: Env): WatchSource {
    const listId = env.WATCH_LIST_ID?.trim();
    if (listId) return { kind: 'list', listId };
    throw new ConfigError('Set WATCH_LIST_ID to an X List id (the id in x.com/i/lists/<ID>)');
}

/**
 * Choose the notifier. Honors an explicit NOTIFIER, otherwise auto-detects:
 * Telegram if its creds are present, else Pushover.
 */
export function resolveNotifier(env: Env): NotifierConfig {
    const explicit = env.NOTIFIER?.trim().toLowerCase();
    const hasTelegram = Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim());
    const kind = explicit || (hasTelegram ? 'telegram' : 'pushover');

    if (kind === 'telegram') {
        return { kind: 'telegram', botToken: req(env, 'TELEGRAM_BOT_TOKEN'), chatId: req(env, 'TELEGRAM_CHAT_ID') };
    }
    if (kind === 'pushover') {
        return { kind: 'pushover', token: req(env, 'PUSHOVER_TOKEN'), user: req(env, 'PUSHOVER_USER') };
    }
    throw new ConfigError(`NOTIFIER must be "telegram" or "pushover", got "${explicit}"`);
}

export function resolveConfig(env: Env): ScoutConfig {
    return {
        freshnessMinutes: num(env, 'FRESHNESS_MINUTES', DEFAULT_CONFIG.freshnessMinutes),
        minScore: num(env, 'MIN_SCORE', DEFAULT_CONFIG.minScore),
        maxAlertsPerRun: num(env, 'MAX_ALERTS_PER_RUN', DEFAULT_CONFIG.maxAlertsPerRun),
        dedupRetentionMs: num(env, 'DEDUP_RETENTION_DAYS', DEFAULT_CONFIG.dedupRetentionMs / 86_400_000) * 86_400_000
    };
}

export function loadEnv(env: Env = process.env): ResolvedEnv {
    return {
        dataSource: resolveDataSource(env),
        notifier: resolveNotifier(env),
        watch: resolveWatch(env),
        config: resolveConfig(env),
        statePath: env.STATE_PATH?.trim() || '.scout-state/alerted.json',
        anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined
    };
}

/**
 * Config for the legacy twitterapi.io push Worker (being retired in favour of
 * official-API polling + the Telegram cockpit). Retained until the Worker is
 * reworked. `webhookSecret` is the scraper key the service echoes back.
 */
export interface WorkerConfig {
    webhookSecret: string;
    notifier: NotifierConfig;
    config: ScoutConfig;
}

export function loadWorkerConfig(env: Env): WorkerConfig {
    return {
        webhookSecret: req(env, 'SCRAPER_API_KEY'),
        notifier: resolveNotifier(env),
        config: resolveConfig(env)
    };
}
