import { describe, it, expect } from 'vitest';
import { InMemoryMeasurementStore } from '../src/measure/MeasurementStore';
import { D1MeasurementStore, type D1Like, type D1Stmt } from '../src/measure/D1MeasurementStore';
import { MeasurementRecorder, NoopAlertRecorder, toAlertRow } from '../src/measure/AlertRecorder';
import type { AlertRow } from '../src/measure/types';
import type { ScoredTweet } from '../src/types';
import { runScout } from '../src/pipeline';
import { FakeSource } from '../src/sources/FakeSource';
import { ConsoleNotifier } from '../src/notify/ConsoleNotifier';
import { InMemoryAlertStore } from '../src/store/AlertStore';
import type { SourceTweet } from '../src/sources/TweetSource';
import { DEFAULT_CONFIG, type TweetData } from '../src/types';

const NOW = Date.UTC(2026, 5, 10, 12, 0, 0);

function scored(over: Partial<ScoredTweet> = {}): ScoredTweet {
    return {
        tweet: { tweetId: 't1', authorHandle: 'jane', postedAt: NOW - 120000, likes: 5, retweets: 1, replies: 2, views: 900, isReply: false, isThread: false, authorFollowerCount: 50000, authorIsPremium: true },
        score: 88,
        badge: 'hot',
        components: { authorValue: 30, timingMultiplier: 1.6, competitionFactor: 1.3, relationshipBonus: 0, riskPenalty: 0 },
        ageMinutes: 2,
        ...over
    };
}

describe('toAlertRow', () => {
    it('maps a scored tweet to a measurement row with score components', () => {
        const row = toAlertRow(scored(), NOW, 'poll');
        expect(row).toMatchObject({
            tweetId: 't1', authorHandle: 'jane', alertedAt: NOW, postedAt: NOW - 120000,
            score: 88, badge: 'hot', authorValue: 30, timingMultiplier: 1.6,
            competitionFactor: 1.3, replyCountAtAlert: 2, source: 'poll'
        });
    });
});

describe('InMemoryMeasurementStore', () => {
    it('records alerts idempotently (first write per tweetId wins)', async () => {
        const s = new InMemoryMeasurementStore();
        await s.recordAlerts([toAlertRow(scored(), NOW, 'poll')]);
        await s.recordAlerts([toAlertRow(scored({ score: 1 }), NOW + 1, 'poll')]); // same tweetId
        const all = s.snapshot().alerts;
        expect(all).toHaveLength(1);
        expect(all[0].score).toBe(88);
    });

    it('computes the funnel from alerts + reply actions', async () => {
        const s = new InMemoryMeasurementStore();
        await s.recordAlerts([toAlertRow(scored({ tweet: { ...scored().tweet, tweetId: 'a' } }), NOW, 'poll')]);
        await s.recordAlerts([toAlertRow(scored({ tweet: { ...scored().tweet, tweetId: 'b' }, score: 72 }), NOW, 'poll')]);
        await s.recordReplyAction({ tweetId: 'a', replied: true, usedDraft: true });
        await s.recordReplyAction({ tweetId: 'b', replied: false });

        const f = await s.funnel();
        expect(f.alerts).toBe(2);
        expect(f.replied).toBe(1);
        expect(f.replyRate).toBe(0.5);
        expect(f.usedDraft).toBe(1);
        expect(f.avgScore).toBe(80);
    });

    it('returns recent alerts newest-first, filtered by time', async () => {
        const s = new InMemoryMeasurementStore();
        await s.recordAlerts([
            toAlertRow(scored({ tweet: { ...scored().tweet, tweetId: 'old' } }), NOW - 10_000, 'poll'),
            toAlertRow(scored({ tweet: { ...scored().tweet, tweetId: 'new' } }), NOW, 'poll')
        ]);
        const recent = await s.recentAlerts(NOW - 5_000);
        expect(recent.map(a => a.tweetId)).toEqual(['new']);
    });
});

describe('MeasurementRecorder / NoopAlertRecorder', () => {
    it('records alerted tweets into the store, tagged with the source', async () => {
        const store = new InMemoryMeasurementStore();
        const rec = new MeasurementRecorder(store, 'poll');
        await rec.record([scored()], NOW);
        expect(store.snapshot().alerts[0]).toMatchObject({ tweetId: 't1', source: 'poll' });
    });
    it('no-ops on an empty batch', async () => {
        const store = new InMemoryMeasurementStore();
        await new MeasurementRecorder(store).record([], NOW);
        expect(store.snapshot().alerts).toHaveLength(0);
    });
    it('Noop recorder does nothing', async () => {
        await expect(new NoopAlertRecorder().record()).resolves.toBeUndefined();
    });
});

describe('D1MeasurementStore (SQL wiring against a fake D1)', () => {
    function fakeD1() {
        const runs: Array<{ sql: string; binds: unknown[] }> = [];
        let results: unknown[] = [];
        let firstRow: unknown = null;
        const db: D1Like = {
            prepare(sql: string): D1Stmt {
                let binds: unknown[] = [];
                const stmt: D1Stmt = {
                    bind(...vals) { binds = vals; return stmt; },
                    async run() { runs.push({ sql, binds }); return {}; },
                    async all<T>() { return { results: results as T[] }; },
                    async first<T>() { return firstRow as T | null; }
                };
                return stmt;
            }
        };
        return { db, runs, setResults: (r: unknown[]) => { results = r; }, setFirst: (f: unknown) => { firstRow = f; } };
    }

    it('inserts alert rows with bound params', async () => {
        const f = fakeD1();
        await new D1MeasurementStore(f.db).recordAlerts([toAlertRow(scored(), NOW, 'poll')]);
        expect(f.runs).toHaveLength(1);
        expect(f.runs[0].sql).toMatch(/INSERT OR IGNORE INTO alert/);
        expect(f.runs[0].binds[0]).toBe('t1');
        expect(f.runs[0].binds).toContain('poll');
    });

    it('maps recentAlerts SQL rows back to camelCase AlertRow', async () => {
        const f = fakeD1();
        f.setResults([{
            tweet_id: 'x', author_handle: 'bob', alerted_at: NOW, posted_at: NOW - 1000,
            score: 90, badge: 'hot', author_value: 25, timing_multiplier: 2, competition_factor: 1.5,
            reply_count_at_alert: 0, source: 'poll'
        }]);
        const out = await new D1MeasurementStore(f.db).recentAlerts(NOW - 5000);
        expect(out[0]).toMatchObject({ tweetId: 'x', authorHandle: 'bob', timingMultiplier: 2, source: 'poll' } as Partial<AlertRow>);
    });

    it('rolls up the funnel from a single aggregate row', async () => {
        const f = fakeD1();
        f.setFirst({ alerts: 4, replied: 2, used_draft: 1, avg_score: 81 });
        const funnel = await new D1MeasurementStore(f.db).funnel();
        expect(funnel).toEqual({ alerts: 4, replied: 2, replyRate: 0.5, usedDraft: 1, avgScore: 81 });
    });
});

describe('pipeline → recorder hook', () => {
    function st(over: Partial<TweetData> = {}): SourceTweet {
        return {
            data: { tweetId: 'hot', authorHandle: 'titan', postedAt: NOW - 120000, likes: 0, retweets: 0, replies: 0, views: 0, isReply: false, isThread: false, authorFollowerCount: 250000, authorIsPremium: true, ...over },
            text: 'big news'
        };
    }
    it('records alerted tweets via the injected recorder', async () => {
        const store = new InMemoryMeasurementStore();
        const summary = await runScout({ kind: 'list', listId: 'L' }, {
            source: new FakeSource([st()]),
            notifier: new ConsoleNotifier(() => {}),
            store: new InMemoryAlertStore(),
            recorder: new MeasurementRecorder(store, 'poll'),
            config: { ...DEFAULT_CONFIG, minScore: 50 },
            now: () => NOW
        });
        expect(summary.alerted).toBe(1);
        expect(store.snapshot().alerts.map(a => a.tweetId)).toEqual(['hot']);
    });
});
