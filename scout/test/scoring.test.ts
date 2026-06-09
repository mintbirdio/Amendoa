import { describe, it, expect } from 'vitest';
import { scoreTweet, tweetPermalink } from '../src/scoring';
import {
    calculateAuthorValue,
    calculateTimingMultiplier,
    calculateCompetitionFactor,
    composeScore,
    getScoreBadge
} from '../../src/shared/scoring';
import type { TweetData } from '../src/types';

const NOW = Date.UTC(2026, 5, 9, 12, 0, 0); // fixed clock

function tweet(over: Partial<TweetData> = {}): TweetData {
    return {
        tweetId: '100',
        authorHandle: 'businessbarista',
        postedAt: NOW - 2 * 60 * 1000, // 2 min old
        likes: 0,
        retweets: 0,
        replies: 0,
        views: 0,
        isReply: false,
        isThread: false,
        authorFollowerCount: 250_000,
        authorIsPremium: true,
        ...over
    };
}

describe('scoreTweet (reuses shared brain, Discovery mode)', () => {
    it('matches the shared engine composition exactly', () => {
        const t = tweet();
        const expectedComponents = {
            authorValue: calculateAuthorValue(null, true, 250_000),
            timingMultiplier: calculateTimingMultiplier(t.postedAt, NOW),
            competitionFactor: calculateCompetitionFactor(0),
            relationshipBonus: 0,
            riskPenalty: 0
        };
        const expectedScore = composeScore(expectedComponents);

        const scored = scoreTweet(t, { now: NOW });
        expect(scored.components).toEqual(expectedComponents);
        expect(scored.score).toBe(expectedScore);
        expect(scored.badge).toBe(getScoreBadge(expectedScore));
    });

    it('a fresh titan post with zero replies is HOT (>=80)', () => {
        // authorValue: titan(25)+premium(8)=33; timing 2.0; competition 1.5
        // 33 * 2.0 * 1.5 = 99 → hot
        const scored = scoreTweet(tweet({ replies: 0 }), { now: NOW });
        expect(scored.score).toBe(99);
        expect(scored.badge).toBe('hot');
    });

    it('decays with age', () => {
        const fresh = scoreTweet(tweet({ postedAt: NOW - 2 * 60_000 }), { now: NOW });
        const old = scoreTweet(tweet({ postedAt: NOW - 6 * 60 * 60_000 }), { now: NOW });
        expect(old.score).toBeLessThan(fresh.score);
    });

    it('decays as replies pile up (competition)', () => {
        const early = scoreTweet(tweet({ replies: 0 }), { now: NOW });
        const crowded = scoreTweet(tweet({ replies: 40 }), { now: NOW });
        expect(crowded.score).toBeLessThan(early.score);
    });

    it('small accounts score lower than titans, all else equal', () => {
        const titan = scoreTweet(tweet({ authorFollowerCount: 250_000 }), { now: NOW });
        const small = scoreTweet(tweet({ authorFollowerCount: 200, authorIsPremium: false }), { now: NOW });
        expect(small.score).toBeLessThan(titan.score);
    });

    it('carries through author name and text', () => {
        const scored = scoreTweet(tweet(), { now: NOW, authorName: 'Alex Lieberman', text: 'hello' });
        expect(scored.authorName).toBe('Alex Lieberman');
        expect(scored.text).toBe('hello');
    });
});

describe('tweetPermalink', () => {
    it('builds the bare X permalink', () => {
        expect(tweetPermalink('businessbarista', '123')).toBe('https://x.com/businessbarista/status/123');
    });
    it('strips a leading @', () => {
        expect(tweetPermalink('@foo', '9')).toBe('https://x.com/foo/status/9');
    });
});
