import { describe, it, expect, vi } from 'vitest';
import {
    ScraperSource,
    mapRawTweet,
    extractTweets,
    isRetweet,
    type RawTweet
} from '../src/sources/ScraperSource';
import type { FetchFn } from '../src/sources/TweetSource';

function fakeFetch(payload: unknown, ok = true, status = 200): FetchFn {
    return vi.fn(async () => ({
        ok,
        status,
        async text() { return typeof payload === 'string' ? payload : JSON.stringify(payload); },
        async json() { return payload; }
    }));
}

const now = Date.now();

function rawTweet(over: Partial<RawTweet> = {}): RawTweet {
    return {
        id_str: '500',
        full_text: 'hello world',
        created_at: new Date(now - 60_000).toISOString(),
        reply_count: 2,
        like_count: 10,
        retweet_count: 1,
        view_count: 1000,
        author: { userName: 'JaneDoe', name: 'Jane Doe', followers: 50_000, isBlueVerified: true },
        ...over
    };
}

describe('extractTweets', () => {
    it('handles a bare array', () => {
        expect(extractTweets([rawTweet()])).toHaveLength(1);
    });
    it('unwraps common envelopes', () => {
        expect(extractTweets({ tweets: [rawTweet()] })).toHaveLength(1);
        expect(extractTweets({ data: [rawTweet(), rawTweet()] })).toHaveLength(2);
    });
    it('returns [] for junk', () => {
        expect(extractTweets(null)).toEqual([]);
        expect(extractTweets({ nope: 1 })).toEqual([]);
    });
});

describe('mapRawTweet', () => {
    it('maps a full tweet to TweetData', () => {
        const mapped = mapRawTweet(rawTweet())!;
        expect(mapped.data.tweetId).toBe('500');
        expect(mapped.data.authorHandle).toBe('janedoe'); // normalized
        expect(mapped.data.replies).toBe(2);
        expect(mapped.data.authorFollowerCount).toBe(50_000);
        expect(mapped.data.authorIsPremium).toBe(true);
        expect(mapped.data.isReply).toBe(false);
        expect(mapped.authorName).toBe('Jane Doe');
        expect(mapped.text).toBe('hello world');
    });

    it('falls back to snowflake time when created_at is missing', () => {
        const mapped = mapRawTweet(rawTweet({ id_str: '2064089261121626531', created_at: undefined }))!;
        expect(mapped.data.postedAt).toBeGreaterThan(Date.UTC(2025, 0, 1));
    });

    it('detects replies via in_reply_to_status_id', () => {
        const mapped = mapRawTweet(rawTweet({ in_reply_to_status_id: '123' }))!;
        expect(mapped.data.isReply).toBe(true);
    });

    it('tolerates alternate field names', () => {
        const mapped = mapRawTweet({
            id: '7',
            text: 'hi',
            createdAt: new Date(now).toISOString(),
            replyCount: 3,
            likeCount: 4,
            user: { screen_name: 'bob', followersCount: 1200, verified: true }
        })!;
        expect(mapped.data.tweetId).toBe('7');
        expect(mapped.data.authorHandle).toBe('bob');
        expect(mapped.data.replies).toBe(3);
        expect(mapped.data.authorFollowerCount).toBe(1200);
        expect(mapped.data.authorIsPremium).toBe(true);
    });

    it('returns null when id or handle missing', () => {
        expect(mapRawTweet({ full_text: 'x' })).toBeNull();
        expect(mapRawTweet({ id_str: '1' })).toBeNull(); // no author
    });

    it('defaults missing engagement counts to 0', () => {
        const mapped = mapRawTweet({ id_str: '9', created_at: new Date(now).toISOString(), author: { userName: 'a' } })!;
        expect(mapped.data.replies).toBe(0);
        expect(mapped.data.likes).toBe(0);
        expect(mapped.data.authorFollowerCount).toBe(0);
    });
});

describe('isRetweet', () => {
    it('flags retweets', () => {
        expect(isRetweet({ is_retweet: true })).toBe(true);
        expect(isRetweet({ retweeted_tweet: {} })).toBe(true);
        expect(isRetweet({ id_str: '1' })).toBe(false);
    });
});

describe('ScraperSource.buildUrl', () => {
    const src = new ScraperSource({ apiKey: 'k', fetchFn: fakeFetch([]) });
    it('builds list url', () => {
        expect(src.buildUrl({ kind: 'list', listId: 'L1' })).toContain('/twitter/list/tweets?listId=L1');
    });
    it('builds following url', () => {
        expect(src.buildUrl({ kind: 'following', userId: 'U1' })).toContain('following_timeline?userId=U1');
    });
});

describe('ScraperSource.fetchRecentOriginals', () => {
    it('requires an api key', () => {
        expect(() => new ScraperSource({ apiKey: '' })).toThrow(/apiKey/);
    });

    it('keeps fresh originals, drops replies/retweets/stale, newest first', async () => {
        const payload = {
            tweets: [
                rawTweet({ id_str: '1', created_at: new Date(now - 5 * 60_000).toISOString() }),
                rawTweet({ id_str: '2', created_at: new Date(now - 1 * 60_000).toISOString() }),
                rawTweet({ id_str: '3', in_reply_to_status_id: '99', created_at: new Date(now).toISOString() }), // reply
                rawTweet({ id_str: '4', is_retweet: true, created_at: new Date(now).toISOString() }),          // RT
                rawTweet({ id_str: '5', created_at: new Date(now - 120 * 60_000).toISOString() })              // stale
            ]
        };
        const src = new ScraperSource({ apiKey: 'k', fetchFn: fakeFetch(payload) });
        const out = await src.fetchRecentOriginals({ kind: 'list', listId: 'L1' }, 60);
        expect(out.map(t => t.data.tweetId)).toEqual(['2', '1']); // fresh originals, newest first
    });

    it('sends the api key header', async () => {
        const ff = fakeFetch({ tweets: [] });
        const src = new ScraperSource({ apiKey: 'secret', fetchFn: ff });
        await src.fetchRecentOriginals({ kind: 'list', listId: 'L1' }, 60);
        expect(ff).toHaveBeenCalledWith(
            expect.stringContaining('listId=L1'),
            expect.objectContaining({ headers: expect.objectContaining({ 'X-API-Key': 'secret' }) })
        );
    });

    it('throws on non-ok response', async () => {
        const src = new ScraperSource({ apiKey: 'k', fetchFn: fakeFetch('rate limited', false, 429) });
        await expect(src.fetchRecentOriginals({ kind: 'list', listId: 'L1' }, 60)).rejects.toThrow(/429/);
    });
});
