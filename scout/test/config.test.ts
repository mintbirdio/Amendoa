import { describe, it, expect } from 'vitest';
import { resolveWatch, resolveConfig, resolveNotifier, loadEnv, ConfigError } from '../src/config';
import { DEFAULT_CONFIG } from '../src/types';

describe('resolveWatch', () => {
    it('prefers a list id', () => {
        expect(resolveWatch({ WATCH_LIST_ID: 'L1', WATCH_USER_ID: 'U1' })).toEqual({ kind: 'list', listId: 'L1' });
    });
    it('falls back to following', () => {
        expect(resolveWatch({ WATCH_USER_ID: 'U1' })).toEqual({ kind: 'following', userId: 'U1' });
    });
    it('throws when neither set', () => {
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

describe('loadEnv', () => {
    const base = {
        SCRAPER_API_KEY: 'k',
        TELEGRAM_BOT_TOKEN: 'b',
        TELEGRAM_CHAT_ID: 'c',
        WATCH_LIST_ID: 'L1'
    };

    it('loads a complete env (Telegram)', () => {
        const env = loadEnv(base);
        expect(env.scraperApiKey).toBe('k');
        expect(env.notifier).toEqual({ kind: 'telegram', botToken: 'b', chatId: 'c' });
        expect(env.watch).toEqual({ kind: 'list', listId: 'L1' });
        expect(env.statePath).toBe('.scout-state/alerted.json');
    });

    it('loads a complete env (Pushover)', () => {
        const env = loadEnv({ SCRAPER_API_KEY: 'k', PUSHOVER_TOKEN: 't', PUSHOVER_USER: 'u', WATCH_LIST_ID: 'L1' });
        expect(env.notifier).toEqual({ kind: 'pushover', token: 't', user: 'u' });
    });

    it('throws on missing required secret', () => {
        expect(() => loadEnv({ ...base, TELEGRAM_BOT_TOKEN: '' })).toThrow(ConfigError);
        expect(() => loadEnv({ ...base, SCRAPER_API_KEY: undefined })).toThrow(ConfigError);
    });

    it('throws when no watch target', () => {
        const { WATCH_LIST_ID, ...noWatch } = base;
        void WATCH_LIST_ID;
        expect(() => loadEnv(noWatch)).toThrow(/WATCH_LIST_ID/);
    });
});
