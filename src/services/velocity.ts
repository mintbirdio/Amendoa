/**
 * Velocity Metric Calculator
 * Calculates engagement velocity (V_t) for tweets
 */

export interface TweetMetrics {
    tweetId: string;
    velocity: number; // Engagements per minute
    level: 'COLD' | 'WARM' | 'HOT' | 'NUCLEAR';
    createdAt: Date;
    engagementTotal: number;
    ageMinutes: number;
}

/**
 * Extract timestamp from Twitter Snowflake ID
 * Twitter Snowflake IDs contain a timestamp in the higher-order bits
 * Formula: timestamp = (id >> 22) + 1288834974657
 */
export function extractTimestampFromSnowflake(tweetId: string): Date {
    const TWITTER_EPOCH = 1288834974657; // Twitter's custom epoch (Nov 04 2010 01:42:54 UTC)

    // Validate that the ID is numeric (not "card://..." or other prefixes)
    if (!/^\d+$/.test(tweetId)) {
        console.warn(`Invalid Snowflake ID: ${tweetId}, using current time`);
        return new Date(); // Fallback to current time
    }

    try {
        const id = BigInt(tweetId);
        const timestamp = Number(id >> 22n) + TWITTER_EPOCH;
        return new Date(timestamp);
    } catch (error) {
        console.warn(`Failed to parse Snowflake ID: ${tweetId}`, error);
        return new Date(); // Fallback to current time
    }
}

/**
 * Calculate weighted engagement score
 * Likes × 1, Retweets × 2, Replies × 3
 */
export function calculateEngagementScore(
    likes: number,
    retweets: number,
    replies: number
): number {
    return (likes * 1) + (retweets * 2) + (replies * 3);
}

/**
 * Calculate velocity (V_t) = E_total / Δt
 * Returns engagements per minute
 */
export function calculateVelocity(tweet: {
    id: string;
    likes: number;
    retweets: number;
    replies: number;
    createdAt?: Date;
}): TweetMetrics {
    const createdAt = tweet.createdAt || extractTimestampFromSnowflake(tweet.id);
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    const ageMinutes = Math.max(ageMs / 1000 / 60, 1); // Minimum 1 minute to avoid division by zero

    const engagementTotal = calculateEngagementScore(
        tweet.likes,
        tweet.retweets,
        tweet.replies
    );

    const velocity = engagementTotal / ageMinutes;

    // Determine level based on velocity thresholds
    let level: TweetMetrics['level'] = 'COLD';
    if (velocity > 100) level = 'NUCLEAR'; // Viral anomaly (top 0.1%)
    else if (velocity > 20) level = 'HOT'; // Going viral (top 5%)
    else if (velocity > 5) level = 'WARM'; // Rising (top 20%)

    return {
        tweetId: tweet.id,
        velocity,
        level,
        createdAt,
        engagementTotal,
        ageMinutes
    };
}

/**
 * Batch calculate velocity for multiple tweets
 */
export function calculateVelocityBatch(tweets: Array<{
    id: string;
    likes: number;
    retweets: number;
    replies: number;
    createdAt?: Date;
}>): TweetMetrics[] {
    return tweets.map(calculateVelocity);
}

/**
 * Get top N tweets by velocity
 */
export function getTopByVelocity(
    metrics: TweetMetrics[],
    limit: number = 10
): TweetMetrics[] {
    return [...metrics]
        .sort((a, b) => b.velocity - a.velocity)
        .slice(0, limit);
}
