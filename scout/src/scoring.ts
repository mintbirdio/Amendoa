/**
 * Scout scoring — reuses the shared brain.
 *
 * Scout has no per-target relationship DB, so it scores in "Discovery mode":
 * target = null, relationshipBonus = 0, and competition-vs-spam risk is handled
 * separately by the dedup store (not as a score penalty). Author value therefore
 * comes purely from follower count + premium status — exactly the path the shared
 * `calculateAuthorValue(null, ...)` already implements.
 */

import {
    type TweetData,
    type ScoreComponents,
    calculateAuthorValue,
    calculateTimingMultiplier,
    calculateCompetitionFactor,
    composeScore,
    getScoreBadge
} from '../../src/shared/scoring';
import type { ScoredTweet } from './types';

export interface ScoreTweetOptions {
    now?: number;
    authorName?: string;
    text?: string;
}

/**
 * Score a single tweet the Scout way (Discovery mode, no DB).
 */
export function scoreTweet(tweet: TweetData, opts: ScoreTweetOptions = {}): ScoredTweet {
    const now = opts.now ?? Date.now();

    const components: ScoreComponents = {
        authorValue: calculateAuthorValue(
            null,
            tweet.authorIsPremium ?? false,
            tweet.authorFollowerCount ?? 0
        ),
        timingMultiplier: calculateTimingMultiplier(tweet.postedAt, now),
        competitionFactor: calculateCompetitionFactor(tweet.replies),
        relationshipBonus: 0,
        riskPenalty: 0
    };

    const score = composeScore(components);

    return {
        tweet,
        score,
        badge: getScoreBadge(score),
        components,
        ageMinutes: (now - tweet.postedAt) / 1000 / 60,
        authorName: opts.authorName,
        text: opts.text
    };
}

/** Build the canonical X permalink that deep-links into the app on the tweet. */
export function tweetPermalink(handle: string, tweetId: string): string {
    const clean = handle.replace(/^@/, '');
    return `https://x.com/${clean}/status/${tweetId}`;
}
