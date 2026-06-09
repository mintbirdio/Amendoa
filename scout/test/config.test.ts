import { describe, it, expect } from 'vitest';
import { resolveWatch, resolveConfig, loadEnv, ConfigError } from '../src/config';
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

describe('loadEnv', () => {
    const base = {
        SCRAPER_API_KEY: 'k',
        PUSHOVER_TOKEN: 't',
        PUSHOVER_USER: 'u',
        WATCH_LIST_ID: 'L1'
    };

    it('loads a complete env', () => {
        const env = loadEnv(base);
        expect(env.scraperApiKey).toBe('k');
        expect(env.watch).toEqual({ kind: 'list', listId: 'L1' });
        expect(env.statePath).toBe('.scout-state/alerted.json');
    });

    it('throws on missing required secret', () => {
        expect(() => loadEnv({ ...base, PUSHOVER_TOKEN: '' })).toThrow(ConfigError);
        expect(() => loadEnv({ ...base, SCRAPER_API_KEY: undefined })).toThrow(ConfigError);
    });

    it('throws when no watch target', () => {
        const { WATCH_LIST_ID, ...noWatch } = base;
        void WATCH_LIST_ID;
        expect(() => loadEnv(noWatch)).toThrow(/WATCH_LIST_ID/);
    });
});
