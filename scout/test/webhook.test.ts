import { describe, it, expect } from 'vitest';
import { parseWebhookTweets } from '../src/webhook/payload';
import { buildRuleValues, cleanHandle, MAX_RULE_LEN } from '../src/webhook/rule';

const now = Date.now();

function tweet(over: Record<string, unknown> = {}) {
    return {
        id: '900',
        text: 'shipping something new',
        created_at: new Date(now - 30_000).toISOString(),
        like_count: 5,
        retweet_count: 1,
        reply_count: 0,
        author: { username: 'JaneDoe', name: 'Jane Doe', followers: 80_000, isBlueVerified: true },
        ...over
    };
}

describe('parseWebhookTweets', () => {
    it('maps tweets from the { event_type, tweets } envelope', () => {
        const out = parseWebhookTweets({ event_type: 'tweet', rule_id: 'r1', tweets: [tweet()] });
        expect(out).toHaveLength(1);
        expect(out[0].data.tweetId).toBe('900');
        expect(out[0].data.authorHandle).toBe('janedoe');   // lowercase `username` accepted + normalized
        expect(out[0].data.authorFollowerCount).toBe(80_000);
        expect(out[0].authorName).toBe('Jane Doe');
    });

    it('ignores non-tweet control frames (connected/ping)', () => {
        expect(parseWebhookTweets({ event_type: 'connected' })).toEqual([]);
        expect(parseWebhookTweets({ event_type: 'ping' })).toEqual([]);
    });

    it('drops retweets defensively', () => {
        const out = parseWebhookTweets({ event_type: 'tweet', tweets: [tweet({ is_retweet: true }), tweet({ id: '901' })] });
        expect(out.map(t => t.data.tweetId)).toEqual(['901']);
    });

    it('tolerates a bare array and junk', () => {
        expect(parseWebhookTweets([tweet()])).toHaveLength(1);
        expect(parseWebhookTweets(null)).toEqual([]);
        expect(parseWebhookTweets({ nope: 1 })).toEqual([]);
    });
});

describe('buildRuleValues', () => {
    it('builds one rule for a short list, excluding RTs and replies', () => {
        const [rule, ...rest] = buildRuleValues(['alice', 'bob']);
        expect(rest).toHaveLength(0);
        expect(rule).toBe('(from:alice OR from:bob) -filter:retweets -filter:replies');
    });

    it('strips @, lowercases, and dedupes', () => {
        expect(cleanHandle('  @Alice ')).toBe('alice');
        const rules = buildRuleValues(['@Alice', 'alice', 'ALICE']);
        expect(rules).toEqual(['(from:alice) -filter:retweets -filter:replies']);
    });

    it('splits across multiple rules when over the 255-char cap, each within the cap', () => {
        const handles = Array.from({ length: 40 }, (_, i) => `account_number_${i}`);
        const rules = buildRuleValues(handles);
        expect(rules.length).toBeGreaterThan(1);
        for (const r of rules) expect(r.length).toBeLessThanOrEqual(MAX_RULE_LEN);
        // every handle ends up in exactly one rule
        const joined = rules.join(' ');
        for (const h of handles) expect(joined).toContain(`from:${h}`);
    });
});
