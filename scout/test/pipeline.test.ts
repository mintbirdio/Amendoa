import { describe, it, expect, vi } from 'vitest';
import { runScout } from '../src/pipeline';
import { FakeSource } from '../src/sources/FakeSource';
import { ConsoleNotifier } from '../src/notify/ConsoleNotifier';
import { InMemoryAlertStore } from '../src/store/AlertStore';
import type { SourceTweet } from '../src/sources/TweetSource';
import type { Notifier } from '../src/notify/Notifier';
import type { TweetData, ScoutConfig } from '../src/types';
import { DEFAULT_CONFIG } from '../src/types';

const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);
const clock = () => NOW;

function st(over: Partial<TweetData> = {}, extras: { name?: string; text?: string } = {}): SourceTweet {
    return {
        data: {
            tweetId: Math.random().toString(36).slice(2),
            authorHandle: 'titan',
            postedAt: NOW - 2 * 60_000,
            likes: 0, retweets: 0, replies: 0, views: 0,
            isReply: false, isThread: false,
            authorFollowerCount: 250_000, authorIsPremium: true,
            ...over
        },
        authorName: extras.name,
        text: extras.text
    };
}

function cfg(over: Partial<ScoutConfig> = {}): ScoutConfig {
    return { ...DEFAULT_CONFIG, ...over };
}

describe('runScout pipeline', () => {
    it('alerts on high-scoring fresh originals only', async () => {
        const source = new FakeSource([
            st({ tweetId: 'hot', replies: 0 }),                                   // ~100 → alert
            st({ tweetId: 'reply', isReply: true }),                              // reply → never
            st({ tweetId: 'small', authorFollowerCount: 100, authorIsPremium: false, replies: 30 }), // low → below threshold
        ]);
        const notifier = new ConsoleNotifier(() => {});
        const store = new InMemoryAlertStore();

        const summary = await runScout({ kind: 'list', listId: 'L' }, {
            source, notifier, store, config: cfg({ minScore: 70 }), now: clock
        });

        expect(summary.alerted).toBe(1);
        expect(summary.alerts[0].tweet.tweetId).toBe('hot');
        expect(notifier.sent).toHaveLength(1);
    });

    it('never alerts on the same tweet twice across runs', async () => {
        const source = new FakeSource([st({ tweetId: 'hot', replies: 0 })]);
        const notifier = new ConsoleNotifier(() => {});
        const store = new InMemoryAlertStore();
        const deps = { source, notifier, store, config: cfg(), now: clock };

        const first = await runScout({ kind: 'list', listId: 'L' }, deps);
        const second = await runScout({ kind: 'list', listId: 'L' }, deps);

        expect(first.alerted).toBe(1);
        expect(second.alerted).toBe(0);
        expect(second.deduped).toBe(1);
        expect(notifier.sent).toHaveLength(1);
    });

    it('caps alerts per run', async () => {
        const many = Array.from({ length: 10 }, (_, i) => st({ tweetId: `t${i}`, replies: 0 }));
        const source = new FakeSource(many);
        const notifier = new ConsoleNotifier(() => {});
        const store = new InMemoryAlertStore();

        const summary = await runScout({ kind: 'list', listId: 'L' }, {
            source, notifier, store, config: cfg({ maxAlertsPerRun: 3 }), now: clock
        });

        expect(summary.alerted).toBe(3);
        expect(summary.eligible).toBe(10);
    });

    it('orders alerts by score descending', async () => {
        const source = new FakeSource([
            st({ tweetId: 'mid', authorFollowerCount: 12_000, authorIsPremium: false, replies: 8 }),
            st({ tweetId: 'top', replies: 0 }),
        ]);
        const notifier = new ConsoleNotifier(() => {});
        const store = new InMemoryAlertStore();
        const summary = await runScout({ kind: 'list', listId: 'L' }, {
            source, notifier, store, config: cfg({ minScore: 30, maxAlertsPerRun: 10 }), now: clock
        });
        expect(summary.alerts[0].tweet.tweetId).toBe('top');
    });

    it('prunes stale dedup entries', async () => {
        const store = new InMemoryAlertStore({ old: NOW - 30 * 86_400_000, recent: NOW - 60_000 });
        const source = new FakeSource([]);
        const notifier = new ConsoleNotifier(() => {});
        await runScout({ kind: 'list', listId: 'L' }, {
            source, notifier, store, config: cfg({ dedupRetentionMs: 7 * 86_400_000 }), now: clock
        });
        expect(store.has('old')).toBe(false);
        expect(store.has('recent')).toBe(true);
    });

    it('persists already-sent alerts even if a later send fails (no duplicate next run)', async () => {
        const source = new FakeSource([
            st({ tweetId: 'a', replies: 0 }),
            st({ tweetId: 'b', replies: 0 }),
            st({ tweetId: 'c', replies: 0 })
        ]);
        let calls = 0;
        const flaky: Notifier = {
            async send() {
                calls++;
                if (calls === 2) throw new Error('pushover 500');
            }
        };
        const store = new InMemoryAlertStore();
        const flushSpy = vi.spyOn(store, 'flush');

        await expect(runScout({ kind: 'list', listId: 'L' }, {
            source, notifier: flaky, store, config: cfg({ minScore: 50 }), now: clock
        })).rejects.toThrow('pushover 500');

        expect(flushSpy).toHaveBeenCalled();   // flushed despite the throw
        expect(store.has('a')).toBe(true);     // first (successful) alert persisted
        expect(store.has('b')).toBe(false);    // failed one not marked → retried next run, not duplicated
    });

    it('emits nothing when no tweet clears the threshold', async () => {
        const source = new FakeSource([
            st({ authorFollowerCount: 50, authorIsPremium: false, replies: 60, postedAt: NOW - 5 * 60 * 60_000 })
        ]);
        const notifier = new ConsoleNotifier(() => {});
        const summary = await runScout({ kind: 'list', listId: 'L' }, {
            source, notifier, store: new InMemoryAlertStore(), config: cfg({ minScore: 70 }), now: clock
        });
        expect(summary.alerted).toBe(0);
        expect(notifier.sent).toHaveLength(0);
    });
});
