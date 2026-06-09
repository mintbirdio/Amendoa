/**
 * Twitter/X snowflake ID → timestamp.
 *
 * Tweet IDs encode their creation time: the high bits are milliseconds since
 * the Twitter epoch (2010-11-04T01:42:54.657Z). IDs exceed Number.MAX_SAFE_INTEGER
 * so we parse with BigInt.
 */

const TWITTER_EPOCH_MS = 1288834974657n;

/**
 * Returns the creation timestamp (ms since Unix epoch) for a tweet id, or null
 * if the id is not a valid positive integer string.
 */
export function snowflakeToTimestamp(tweetId: string): number | null {
    if (!/^\d+$/.test(tweetId)) return null;
    try {
        const id = BigInt(tweetId);
        if (id <= 0n) return null;
        const ms = (id >> 22n) + TWITTER_EPOCH_MS;
        return Number(ms);
    } catch {
        return null;
    }
}
