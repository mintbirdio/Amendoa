/**
 * Shared Scoring Core (dependency-free)
 *
 * The pure, environment-agnostic half of the Opportunity Score engine.
 * Contains NO imports — no Dexie, no DOM, no Node — so it can run identically
 * inside the browser extension AND the headless Scout service.
 *
 * The browser-coupled pieces (DB lookups in `calculateRiskPenalty` /
 * `calculateOpportunityScore`) live in `src/services/scoreEngine.ts`, which
 * re-exports everything here so existing extension imports keep working.
 *
 * Formula:
 *   OpportunityScore = (AuthorValue × TimingMultiplier × CompetitionFactor
 *                       + RelationshipBonus) − RiskPenalty
 */

// =============================================================================
// TYPES
// =============================================================================

export type Tier = 'titan' | 'star' | 'rising' | 'emerging' | 'peer';
export type RelationshipStatus = 'mutual' | 'following' | 'follower' | 'none';
export type ScoreBadge = 'hot' | 'high' | 'good' | 'meh' | 'skip';

/**
 * The subset of a target account the pure scorer needs. The extension's full
 * `TargetAccount` is a structural superset, so it remains assignable here.
 */
export interface ScoringTarget {
    tier: Tier;
    isPremium: boolean;
    interactionCount: number;
    relationshipStatus: RelationshipStatus;
    lastInteraction: number | null;
    replyBackRate: number;
}

export interface TweetData {
    tweetId: string;
    authorHandle: string;
    postedAt: number;           // timestamp from snowflake
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    isReply: boolean;
    isThread: boolean;
    // Discovery fields (optional - only for non-targets)
    authorFollowerCount?: number;
    authorIsPremium?: boolean;
}

export interface ScoreComponents {
    authorValue: number;        // 0-40
    timingMultiplier: number;   // 0.1-2.0
    competitionFactor: number;  // 0.3-1.5
    relationshipBonus: number;  // 0-20
    riskPenalty: number;        // 0-30
}

export interface OpportunityScore {
    score: number;              // 0-100
    badge: ScoreBadge;
    components: ScoreComponents;
    tweetAgeMinutes: number;
    isFromTarget: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Follower tier points
export const TIER_POINTS: Record<Tier, number> = {
    titan: 25,      // 100k+ followers - max exposure
    star: 22,       // 50k-100k - sweet spot
    rising: 20,     // 10k-50k - good reach
    emerging: 15,   // 1k-10k - relationship building
    peer: 10        // <1k - community building
};

// Premium account bonus
export const PREMIUM_BONUS = 8;

// Max engagement quality bonus
export const MAX_ENGAGEMENT_QUALITY_BONUS = 7;

// Timing thresholds (minutes) - Adjusted for real-world usability
// Even a 1-2 hour old tweet can still be valuable if competition is low
export const TIMING_MULTIPLIERS: Array<{ maxMinutes: number; multiplier: number }> = [
    { maxMinutes: 5, multiplier: 2.0 },     // GOLD - likely first responder
    { maxMinutes: 15, multiplier: 1.6 },    // Excellent - top 10 position possible
    { maxMinutes: 30, multiplier: 1.3 },    // Great - conversation forming
    { maxMinutes: 60, multiplier: 1.0 },    // Good - still relevant
    { maxMinutes: 120, multiplier: 0.8 },   // Okay - need lower competition
    { maxMinutes: 240, multiplier: 0.5 },   // Late - only if low replies
    { maxMinutes: 480, multiplier: 0.3 },   // Very late - viral only
    { maxMinutes: Infinity, multiplier: 0.15 } // Dead - skip unless exceptional
];

// Competition thresholds
export const COMPETITION_FACTORS: Array<{ maxReplies: number; factor: number }> = [
    { maxReplies: 0, factor: 1.5 },         // First! Maximum visibility
    { maxReplies: 3, factor: 1.3 },         // Early - good positioning
    { maxReplies: 10, factor: 1.0 },        // Moderate - need quality
    { maxReplies: 25, factor: 0.7 },        // Crowded - diminishing returns
    { maxReplies: 50, factor: 0.5 },        // Very crowded - only for titans
    { maxReplies: Infinity, factor: 0.3 }   // Mob scene - probably skip
];

// =============================================================================
// SCORE COMPONENT CALCULATORS (pure)
// =============================================================================

/**
 * Calculate Author Value (0-40 points)
 * Based on tier, premium status, and historical engagement quality.
 * For Discovery (non-targets), we use follower count to infer tier.
 */
export function calculateAuthorValue(
    target: ScoringTarget | null,
    isPremium: boolean = false,
    followerCount: number = 0
): number {
    let value: number;

    if (!target) {
        // Non-target: Calculate value based on follower count (Discovery mode)
        if (followerCount >= 100000) value = TIER_POINTS.titan;
        else if (followerCount >= 50000) value = TIER_POINTS.star;
        else if (followerCount >= 10000) value = TIER_POINTS.rising;
        else if (followerCount >= 1000) value = TIER_POINTS.emerging;
        else value = TIER_POINTS.peer;

        // Premium bonus for non-targets
        if (isPremium) {
            value += PREMIUM_BONUS;
        }

        return Math.min(value, 40);
    }

    value = TIER_POINTS[target.tier];

    // Premium bonus
    if (target.isPremium) {
        value += PREMIUM_BONUS;
    }

    // Engagement quality bonus based on how often they engage
    if (target.interactionCount > 10) {
        value += MAX_ENGAGEMENT_QUALITY_BONUS;
    } else if (target.interactionCount > 5) {
        value += 4;
    } else if (target.interactionCount > 0) {
        value += 2;
    }

    return Math.min(value, 40); // Cap at 40
}

/**
 * Calculate Timing Multiplier (0.1x - 2.0x)
 * Fresher tweets = higher multiplier
 */
export function calculateTimingMultiplier(postedAt: number, now: number = Date.now()): number {
    const ageMs = now - postedAt;
    const ageMinutes = Math.max(ageMs / 1000 / 60, 0);

    for (const tier of TIMING_MULTIPLIERS) {
        if (ageMinutes <= tier.maxMinutes) {
            return tier.multiplier;
        }
    }

    return 0.1; // Fallback for very old tweets
}

/**
 * Calculate Competition Factor (0.3x - 1.5x)
 * Fewer replies = higher factor
 */
export function calculateCompetitionFactor(
    replyCount: number,
    replyVelocity?: number // replies per minute, if available
): number {
    let factor = 1.0;

    for (const tier of COMPETITION_FACTORS) {
        if (replyCount <= tier.maxReplies) {
            factor = tier.factor;
            break;
        }
    }

    // Adjust for velocity - if replies are flooding in, reduce factor
    if (replyVelocity !== undefined && replyVelocity > 5) {
        factor *= 0.7;
    }

    return factor;
}

/**
 * Calculate Relationship Bonus (0-20 points)
 * Prior interaction increases reply-back likelihood
 */
export function calculateRelationshipBonus(target: ScoringTarget | null): number {
    if (!target) return 0;

    let bonus = 0;

    // Relationship status bonus
    switch (target.relationshipStatus) {
        case 'mutual': {
            // Check for recent interaction
            const daysSinceInteraction = target.lastInteraction
                ? (Date.now() - target.lastInteraction) / (1000 * 60 * 60 * 24)
                : Infinity;

            if (daysSinceInteraction < 7) {
                bonus += 20; // Mutual + recent = max bonus
            } else {
                bonus += 12; // Mutual but not recent
            }
            break;
        }

        case 'follower':
            // They follow us but we don't follow them = high engagement chance
            bonus += 15;
            break;

        case 'following':
            // We follow them but they don't follow us
            bonus += 5;
            break;

        case 'none':
            bonus += 0;
            break;
    }

    // Historical reply-back bonus
    if (target.interactionCount > 0) {
        bonus += 8; // They've replied to us before
    }

    // High reply-back rate bonus
    if (target.replyBackRate > 30) {
        bonus += 5;
    }

    return Math.min(bonus, 20); // Cap at 20
}

// =============================================================================
// PARTIAL SCORE COMPOSITION (pure)
// =============================================================================

/**
 * Compose an opportunity score from already-computed component values.
 * Shared by both the extension (which adds DB-derived risk) and Scout.
 */
export function composeScore(components: ScoreComponents): number {
    const { authorValue, timingMultiplier, competitionFactor, relationshipBonus, riskPenalty } = components;
    const rawScore = (authorValue * timingMultiplier * competitionFactor) + relationshipBonus - riskPenalty;
    return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Quick score check without database lookup (for filtering)
 * Only considers timing and competition.
 */
export function quickScoreEstimate(
    postedAt: number,
    replyCount: number,
    now: number = Date.now()
): number {
    const timing = calculateTimingMultiplier(postedAt, now);
    const competition = calculateCompetitionFactor(replyCount);

    // Assume average author value of 20
    return Math.round(20 * timing * competition);
}

/**
 * Check if a tweet is worth scoring in detail.
 * Use this to filter before expensive DB lookups.
 */
export function isWorthScoring(
    postedAt: number,
    replyCount: number,
    now: number = Date.now()
): boolean {
    const estimate = quickScoreEstimate(postedAt, replyCount, now);
    return estimate >= 10; // Only score if estimate is at least "meh"
}

// =============================================================================
// SHARED HELPERS (pure)
// =============================================================================

/**
 * Infer tier from follower count
 */
export function inferTier(followerCount: number): Tier {
    if (followerCount >= 100000) return 'titan';
    if (followerCount >= 50000) return 'star';
    if (followerCount >= 10000) return 'rising';
    if (followerCount >= 1000) return 'emerging';
    return 'peer';
}

/**
 * Get score badge from opportunity score
 */
export function getScoreBadge(score: number): ScoreBadge {
    if (score >= 80) return 'hot';
    if (score >= 60) return 'high';
    if (score >= 40) return 'good';
    if (score >= 20) return 'meh';
    return 'skip';
}

/**
 * Normalize handle (lowercase, remove @ if present)
 */
export function normalizeHandle(handle: string): string {
    return handle.toLowerCase().replace(/^@/, '');
}

// =============================================================================
// SCORE DISPLAY HELPERS (pure)
// =============================================================================

/**
 * Get emoji icon for score badge
 */
export function getBadgeIcon(badge: ScoreBadge): string {
    switch (badge) {
        case 'hot': return '🔥';
        case 'high': return '⚡';
        case 'good': return '✓';
        case 'meh': return '~';
        case 'skip': return '✗';
    }
}

/**
 * Get CSS class for score badge
 */
export function getBadgeClass(badge: ScoreBadge): string {
    return `amendoa-badge--${badge}`;
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
    return score.toString().padStart(2, '0');
}

/**
 * Get human-readable timing label
 */
export function getTimingLabel(ageMinutes: number): string {
    if (ageMinutes < 1) return 'just now';
    if (ageMinutes < 60) return `${Math.round(ageMinutes)}m`;
    if (ageMinutes < 1440) return `${Math.round(ageMinutes / 60)}h`;
    return `${Math.round(ageMinutes / 1440)}d`;
}

/**
 * Get position hint based on reply count
 */
export function getPositionHint(replyCount: number): string {
    if (replyCount === 0) return 'FIRST';
    if (replyCount <= 3) return 'EARLY';
    if (replyCount <= 10) return 'GOOD';
    if (replyCount <= 25) return 'CROWDED';
    return 'MOB';
}
