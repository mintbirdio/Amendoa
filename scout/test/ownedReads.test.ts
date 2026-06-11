import { describe, it, expect, vi } from 'vitest';
import { XOwnedReads } from '../src/xapi/OwnedReads';
import { StaticCredentialProvider } from '../src/sources/Credentials';

const creds = new StaticCredentialProvider({ bearerToken: 'tok', identityId: 'owner' });
const NOW = Date.parse('2026-06-10T12:00:00Z');

function fetchReturning(payload: unknown) {
    return vi.fn(async (_url: string, _init?: { headers?: Record<string, string> }) => ({
        ok: true, status: 200, async text() { return JSON.stringify(payload); }, async json() { return payload; }
    }));
}

describe('XOwnedReads.me', () => {
    it('maps the authenticated user + follower metrics', async () => {
        const ff = fetchReturning({ data: { id: '42', username: 'me', public_metrics: { followers_count: 1234, following_count: 200 } } });
        const me = await new XOwnedReads({ credentials: creds, fetchFn: ff }).me();
        expect(me).toEqual({ id: '42', username: 'me', followerCount: 1234, followingCount: 200 });
        expect(ff.mock.calls[0]![0]).toContain('/users/me');
        expect(ff.mock.calls[0]![1]!.headers!.Authorization).toBe('Bearer tok');
    });
});

describe('XOwnedReads.recentReplies', () => {
    it('keeps only replies and maps their parent id + metrics', async () => {
        const ff = fetchReturning({
            data: [
                { id: 'r1', text: 'great point!', created_at: new Date(NOW).toISOString(), public_metrics: { like_count: 5, retweet_count: 1, reply_count: 0, impression_count: 300 }, referenced_tweets: [{ type: 'replied_to', id: 'parent1' }] },
                { id: 'o1', text: 'an original post', created_at: new Date(NOW).toISOString(), public_metrics: {} }, // not a reply
                { id: 'rt1', text: 'rt', referenced_tweets: [{ type: 'retweeted', id: 'x' }] }                       // retweet
            ]
        });
        const out = await new XOwnedReads({ credentials: creds, fetchFn: ff }).recentReplies('42', 50);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ replyTweetId: 'r1', inReplyToTweetId: 'parent1', text: 'great point!', likes: 5, retweets: 1, impressions: 300, createdAt: NOW });
        expect(ff.mock.calls[0]![0]).toContain('/users/42/tweets');
    });

    it('throws on a non-ok response', async () => {
        const ff = vi.fn(async () => ({ ok: false, status: 401, async text() { return 'unauthorized'; }, async json() { return {}; } }));
        await expect(new XOwnedReads({ credentials: creds, fetchFn: ff }).me()).rejects.toThrow(/401/);
    });
});
