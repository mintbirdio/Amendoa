import { describe, it, expect, vi } from 'vitest';
import { OfficialXSource, officialToRaw } from '../src/sources/OfficialXSource';
import { StaticCredentialProvider } from '../src/sources/Credentials';
import type { FetchFn } from '../src/sources/TweetSource';

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

function fakeFetch(payload: unknown, ok = true, status = 200): FetchFn {
    return vi.fn(async () => ({
        ok, status,
        async text() { return typeof payload === 'string' ? payload : JSON.stringify(payload); },
        async json() { return payload; }
    }));
}

const creds = new StaticCredentialProvider({ bearerToken: 'tok', identityId: 'owner' });

function xResponse() {
    return {
        data: [
            {
                id: '100', text: 'shipping the thing', created_at: iso(60_000), author_id: 'u1',
                public_metrics: { like_count: 9, retweet_count: 2, reply_count: 1, impression_count: 1200 }
            }
        ],
        includes: {
            users: [
                { id: 'u1', username: 'JaneDoe', name: 'Jane Doe', verified_type: 'blue', public_metrics: { followers_count: 60_000 } }
            ]
        }
    };
}

describe('officialToRaw', () => {
    it('hoists public_metrics and joins includes.users by author_id', () => {
        const [raw] = officialToRaw(xResponse());
        expect(raw.id).toBe('100');
        expect(raw.like_count).toBe(9);
        expect(raw.view_count).toBe(1200);            // impression_count → views
        expect(raw.author?.username).toBe('JaneDoe');
        expect(raw.author?.followers_count).toBe(60_000);
        expect(raw.author?.is_blue_verified).toBe(true);   // verified_type 'blue'
    });

    it('derives is_reply / is_retweet from referenced_tweets', () => {
        const users = { users: [{ id: 'u1', username: 'a' }] };
        const [reply] = officialToRaw({ data: [{ id: '1', author_id: 'u1', created_at: iso(0), referenced_tweets: [{ type: 'replied_to', id: '9' }] }], includes: users });
        const [rt] = officialToRaw({ data: [{ id: '2', author_id: 'u1', created_at: iso(0), referenced_tweets: [{ type: 'retweeted', id: '9' }] }], includes: users });
        expect(reply.is_reply).toBe(true);
        expect(rt.is_retweet).toBe(true);
    });

    it('tolerates missing author/includes and empty payloads', () => {
        const [raw] = officialToRaw({ data: [{ id: '3', created_at: iso(0) }] });
        expect(raw.author).toBeUndefined();
        expect(officialToRaw({})).toEqual([]);
    });
});

describe('OfficialXSource', () => {
    it('requires a credentials provider', () => {
        // @ts-expect-error intentionally missing
        expect(() => new OfficialXSource({})).toThrow(/credentials/);
    });

    it('builds the v2 list endpoint with field params', () => {
        const src = new OfficialXSource({ credentials: creds, fetchFn: fakeFetch(xResponse()) });
        const url = src.buildUrl({ kind: 'list', listId: 'L1' });
        expect(url).toContain('/lists/L1/tweets');
        expect(url).toContain('public_metrics');
        expect(url).toContain('verified_type');
    });

    it('sends the bearer token and maps fresh originals', async () => {
        const ff = fakeFetch(xResponse());
        const src = new OfficialXSource({ credentials: creds, fetchFn: ff });
        const out = await src.fetchRecentOriginals({ kind: 'list', listId: 'L1' }, 60);

        expect(out).toHaveLength(1);
        expect(out[0].data.tweetId).toBe('100');
        expect(out[0].data.authorHandle).toBe('janedoe');        // normalized
        expect(out[0].data.views).toBe(1200);
        expect(out[0].data.authorFollowerCount).toBe(60_000);
        expect(out[0].data.authorIsPremium).toBe(true);
        expect(ff).toHaveBeenCalledWith(
            expect.stringContaining('/lists/L1/tweets'),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
        );
    });

    it('drops replies, retweets, and stale tweets — originals only, newest first', async () => {
        const payload = {
            data: [
                { id: '1', text: 'fresh original', created_at: iso(60_000), author_id: 'u1', public_metrics: {} },
                { id: '2', text: 'a reply', created_at: iso(0), author_id: 'u1', referenced_tweets: [{ type: 'replied_to', id: '9' }], public_metrics: {} },
                { id: '3', text: 'a retweet', created_at: iso(0), author_id: 'u1', referenced_tweets: [{ type: 'retweeted', id: '9' }], public_metrics: {} },
                { id: '4', text: 'stale', created_at: iso(120 * 60_000), author_id: 'u1', public_metrics: {} }
            ],
            includes: { users: [{ id: 'u1', username: 'bob', name: 'Bob' }] }
        };
        const src = new OfficialXSource({ credentials: creds, fetchFn: fakeFetch(payload) });
        const out = await src.fetchRecentOriginals({ kind: 'list', listId: 'L1' }, 60);
        expect(out.map(t => t.data.tweetId)).toEqual(['1']);
    });

    it('throws on a non-ok response', async () => {
        const src = new OfficialXSource({ credentials: creds, fetchFn: fakeFetch('rate limited', false, 429) });
        await expect(src.fetchRecentOriginals({ kind: 'list', listId: 'L1' }, 60)).rejects.toThrow(/429/);
    });
});

describe('StaticCredentialProvider', () => {
    it('requires a bearer token', () => {
        expect(() => new StaticCredentialProvider({ bearerToken: '', identityId: 'owner' })).toThrow(/bearerToken/);
    });
    it('resolves the static credential', async () => {
        const p = new StaticCredentialProvider({ bearerToken: 't', identityId: 'owner' });
        expect((await p.resolve()).bearerToken).toBe('t');
    });
});
