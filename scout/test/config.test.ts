import { describe, it, expect } from 'vitest';
import {
    resolveWatch, resolveConfig, resolveNotifier, resolveDataSource, resolveXCredential,
    loadEnv, ConfigError
} from '../src/config';
import { DEFAULT_CONFIG } from '../src/types';

describe('resolveWatch', () => {
    it('resolves a list id', () => {
        expect(resolveWatch({ WATCH_LIST_ID: 'L1' })).toEqual({ kind: 'list', listId: 'L1' });
    });
    it('throws when no list id set', () => {
        expect(() => resolveWatch({})).toThrow(ConfigError);
    });
});

describe('resolveConfig', () => {
    it('uses defaults when unset', () => {
        expect(resolveConfig({})).toEqual(DEFAULT_CONFIG);
    });
    it('applies overrides', () => {
        const c = resolveConfig({ FRESHNESS_MINUTES: '30', MIN_SCORE: '85', MAX_ALERTS_PER_RUN: '5', DEDUP_RETENTION_DAYS: '3' });
        expect(c.freshnessMinutes).toBe(30);
        expect(c.minScore).toBe(85);
        expect(c.maxAlertsPerRun).toBe(5);
        expect(c.dedupRetentionMs).toBe(3 * 86_400_000);
    });
    it('rejects non-numeric', () => {
        expect(() => resolveConfig({ MIN_SCORE: 'high' })).toThrow(ConfigError);
    });
});

describe('resolveNotifier', () => {
    it('auto-detects Telegram when its creds are present', () => {
        expect(resolveNotifier({ TELEGRAM_BOT_TOKEN: 'b', TELEGRAM_CHAT_ID: 'c' }))
            .toEqual({ kind: 'telegram', botToken: 'b', chatId: 'c' });
    });
    it('falls back to Pushover', () => {
        expect(resolveNotifier({ PUSHOVER_TOKEN: 't', PUSHOVER_USER: 'u' }))
            .toEqual({ kind: 'pushover', token: 't', user: 'u' });
    });
    it('honors an explicit NOTIFIER choice', () => {
        const env = { NOTIFIER: 'pushover', PUSHOVER_TOKEN: 't', PUSHOVER_USER: 'u', TELEGRAM_BOT_TOKEN: 'b', TELEGRAM_CHAT_ID: 'c' };
        expect(resolveNotifier(env).kind).toBe('pushover');
    });
    it('throws when the chosen notifier is missing creds', () => {
        expect(() => resolveNotifier({ NOTIFIER: 'telegram' })).toThrow(/TELEGRAM_BOT_TOKEN/);
        expect(() => resolveNotifier({ NOTIFIER: 'pushover', PUSHOVER_TOKEN: 't' })).toThrow(/PUSHOVER_USER/);
    });
    it('rejects an unknown NOTIFIER', () => {
        expect(() => resolveNotifier({ NOTIFIER: 'carrier-pigeon' })).toThrow(ConfigError);
    });
});

describe('resolveXCredential', () => {
    it('prefers a static bearer token', () => {
        expect(resolveXCredential({ X_BEARER_TOKEN: 'tok' })).toEqual({ mode: 'static', bearerToken: 'tok' });
    });
    it('falls back to OAuth refresh creds', () => {
        expect(resolveXCredential({ X_CLIENT_ID: 'cid', X_REFRESH_TOKEN: 'rt' }))
            .toEqual({ mode: 'oauth', clientId: 'cid', refreshToken: 'rt', clientSecret: undefined });
    });
    it('carries a client secret when present', () => {
        expect(resolveXCredential({ X_CLIENT_ID: 'cid', X_REFRESH_TOKEN: 'rt', X_CLIENT_SECRET: 's' }))
            .toEqual({ mode: 'oauth', clientId: 'cid', refreshToken: 'rt', clientSecret: 's' });
    });
    it('throws when no X credentials are set', () => {
        expect(() => resolveXCredential({})).toThrow(/X_BEARER_TOKEN|X_CLIENT_ID/);
    });
});

describe('resolveDataSource', () => {
    it('defaults to official and resolves X creds', () => {
        expect(resolveDataSource({ X_BEARER_TOKEN: 'tok' }))
            .toEqual({ kind: 'official', credential: { mode: 'static', bearerToken: 'tok' } });
    });
    it('uses the scraper when chosen', () => {
        expect(resolveDataSource({ DATA_SOURCE: 'scraper', SCRAPER_API_KEY: 'k' }))
            .toEqual({ kind: 'scraper', apiKey: 'k', baseUrl: undefined });
    });
    it('throws on an unknown source', () => {
        expect(() => resolveDataSource({ DATA_SOURCE: 'carrier-pigeon' })).toThrow(ConfigError);
    });
    it('official mode requires X credentials', () => {
        expect(() => resolveDataSource({})).toThrow(ConfigError);
    });
});

describe('loadEnv', () => {
    const base = {
        X_BEARER_TOKEN: 'tok',
        TELEGRAM_BOT_TOKEN: 'b',
        TELEGRAM_CHAT_ID: 'c',
        WATCH_LIST_ID: 'L1'
    };

    it('loads a complete official + Telegram env', () => {
        const env = loadEnv(base);
        expect(env.dataSource).toEqual({ kind: 'official', credential: { mode: 'static', bearerToken: 'tok' } });
        expect(env.notifier).toEqual({ kind: 'telegram', botToken: 'b', chatId: 'c' });
        expect(env.watch).toEqual({ kind: 'list', listId: 'L1' });
        expect(env.statePath).toBe('.scout-state/alerted.json');
    });

    it('loads a scraper + Pushover env', () => {
        const env = loadEnv({ DATA_SOURCE: 'scraper', SCRAPER_API_KEY: 'k', PUSHOVER_TOKEN: 't', PUSHOVER_USER: 'u', WATCH_LIST_ID: 'L1' });
        expect(env.dataSource).toEqual({ kind: 'scraper', apiKey: 'k', baseUrl: undefined });
        expect(env.notifier).toEqual({ kind: 'pushover', token: 't', user: 'u' });
    });

    it('carries an optional Anthropic key', () => {
        expect(loadEnv({ ...base, ANTHROPIC_API_KEY: 'sk' }).anthropicApiKey).toBe('sk');
        expect(loadEnv(base).anthropicApiKey).toBeUndefined();
    });

    it('throws on missing required config', () => {
        expect(() => loadEnv({ ...base, TELEGRAM_BOT_TOKEN: '' })).toThrow(ConfigError);
        expect(() => loadEnv({ ...base, X_BEARER_TOKEN: undefined })).toThrow(ConfigError);
    });

    it('throws when no watch target', () => {
        const { WATCH_LIST_ID, ...noWatch } = base;
        void WATCH_LIST_ID;
        expect(() => loadEnv(noWatch)).toThrow(/WATCH_LIST_ID/);
    });
});
