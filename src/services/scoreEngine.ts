/**
 * Opportunity Score Engine (browser / extension)
 *
 * Thin, DB-coupled layer over the dependency-free scoring core in
 * `src/shared/scoring.ts`. The pure component calculators, constants, types,
 * and display helpers all live there and are re-exported below so existing
 * `scoreEngine` imports continue to work unchanged.
 *
 * Only the two functions that need the Dexie database live here:
 *   - calculateRiskPenalty   (reads ourReplies to avoid same-day spam)
 *   - calculateOpportunityScore / ...Batch (looks up the target account)
 *
 * Formula:
 *   OpportunityScore = (AuthorValue × TimingMultiplier × CompetitionFactor
 *                       + RelationshipBonus) − RiskPenalty
 */

import { type TargetAccount, db } from '../db';
import {
    type TweetData,
    type ScoreComponents,
    type OpportunityScore,
    calculateAuthorValue,
    calculateTimingMultiplier,
    calculateCompetitionFactor,
    calculateRelationshipBonus,
    composeScore,
    getScoreBadge
} from '../shared/scoring';

// Re-export the entire pure scoring API so `import { ... } from './scoreEngine'`
// keeps resolving the same names it always did.
export * from '../shared/scoring';

// =============================================================================
// DB-COUPLED SCORE COMPONENTS
// =============================================================================

/**
 * Calculate Risk Penalty (0-30 points deducted)
 * Avoid situations that could backfire. Reads the local reply history.
 */
export async function calculateRiskPenalty(
    target: TargetAccount | null,
    authorHandle: string
): Promise<number> {
    let penalty = 0;

    if (target) {
        // Low follower/following ratio suggests bot-like behavior
        if (target.followerCount > 0 && target.followingCount > 0) {
            const ratio = target.followerCount / target.followingCount;
            if (ratio < 0.3) {
                penalty += 10;
            }
        }

        // Author rarely engages with replies
        if (target.ourEngagementCount > 5 && target.interactionCount === 0) {
            penalty += 10; // We've engaged a lot, they never respond
        }
    }

    // Check if we already replied to them today
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today).getTime();

    const repliedToday = await db.ourReplies
        .where('inReplyToHandle')
        .equals(authorHandle.toLowerCase())
        .and(r => r.repliedAt >= todayStart)
        .count();

    if (repliedToday > 0) {
        penalty += 5; // Already replied today - don't spam
    }

    return Math.min(penalty, 30); // Cap at 30
}

// =============================================================================
// MAIN SCORE CALCULATOR
// =============================================================================

/**
 * Calculate the complete Opportunity Score for a tweet
 */
export async function calculateOpportunityScore(
    tweet: TweetData,
    now: number = Date.now()
): Promise<OpportunityScore> {
    // Look up target account
    const targetResult = await db.targetAccounts.get(tweet.authorHandle.toLowerCase());
    const target = targetResult || null;
    const isFromTarget = !!target;

    // Calculate components
    const authorValue = calculateAuthorValue(
        target,
        tweet.authorIsPremium ?? false,
        tweet.authorFollowerCount ?? 0
    );
    const timingMultiplier = calculateTimingMultiplier(tweet.postedAt, now);
    const competitionFactor = calculateCompetitionFactor(tweet.replies);
    const relationshipBonus = calculateRelationshipBonus(target);
    const riskPenalty = await calculateRiskPenalty(target, tweet.authorHandle);

    const components: ScoreComponents = {
        authorValue,
        timingMultiplier,
        competitionFactor,
        relationshipBonus,
        riskPenalty
    };

    const score = composeScore(components);

    return {
        score,
        badge: getScoreBadge(score),
        components,
        tweetAgeMinutes: (now - tweet.postedAt) / 1000 / 60,
        isFromTarget
    };
}

/**
 * Calculate scores for multiple tweets (batch operation)
 */
export async function calculateOpportunityScoreBatch(
    tweets: TweetData[],
    now: number = Date.now()
): Promise<Map<string, OpportunityScore>> {
    const results = new Map<string, OpportunityScore>();

    // Process in parallel
    const scores = await Promise.all(
        tweets.map(tweet => calculateOpportunityScore(tweet, now))
    );

    tweets.forEach((tweet, i) => {
        results.set(tweet.tweetId, scores[i]);
    });

    return results;
}
