/**
 * Environment-driven configuration. Two secrets are required to go live:
 *   SCRAPER_API_KEY  — your scraper provider key   (TODO: provide)
 *   PUSHOVER_TOKEN   — Pushover application token  (TODO: provide)
 *   PUSHOVER_USER    — Pushover user/group key     (TODO: provide)
 * Plus one watch target:
 *   WATCH_LIST_ID    — an X List id (preferred), OR
 *   WATCH_USER_ID    — your user id (to watch your Following feed)
 */

import type { ScoutConfig, WatchSource } from './types';
import { DEFAULT_CONFIG } from './types';

export interface ResolvedEnv {
    scraperApiKey: string;
    scraperBaseUrl?: string;
    pushoverToken: string;
    pushoverUser: string;
    watch: WatchSource;
    config: ScoutConfig;
    statePath: string;
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

/** Resolve the watch target from env (List preferred over Following). */
export function resolveWatch(env: Env): WatchSource {
    const listId = env.WATCH_LIST_ID?.trim();
    if (listId) return { kind: 'list', listId };
    const userId = env.WATCH_USER_ID?.trim();
    if (userId) return { kind: 'following', userId };
    throw new ConfigError('Set WATCH_LIST_ID (preferred) or WATCH_USER_ID to choose what to watch');
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
        scraperApiKey: req(env, 'SCRAPER_API_KEY'),
        scraperBaseUrl: env.SCRAPER_BASE_URL?.trim() || undefined,
        pushoverToken: req(env, 'PUSHOVER_TOKEN'),
        pushoverUser: req(env, 'PUSHOVER_USER'),
        watch: resolveWatch(env),
        config: resolveConfig(env),
        statePath: env.STATE_PATH?.trim() || '.scout-state/alerted.json'
    };
}
