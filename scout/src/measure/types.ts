/**
 * Measurement records — the Phase-0 proof schema. The whole point of Phase-0 is
 * to prove (or kill) the hypothesis: well-timed, voice-matched reply alerts →
 * follower growth. These rows let us compute the funnel (alert → reply →
 * outcome) and the follower trend against a baseline.
 */

/** One alert Scout emitted. */
export interface AlertRow {
    tweetId: string;
    authorHandle: string;
    alertedAt: number;        // ms epoch (Scout clock)
    postedAt: number;         // tweet age at alert = alertedAt - postedAt
    score: number;            // 0-100
    badge: string;
    authorValue: number;      // score component: reach
    timingMultiplier: number; // score component: freshness
    competitionFactor: number;// score component: low-competition
    replyCountAtAlert: number;// how crowded the thread was when alerted
    source: string;           // 'poll' | 'stream' | 'webhook'
    text?: string;            // tweet text — kept so a reply can be drafted on demand
    authorName?: string;      // author display name, for the draft prompt
}

/** Did the human act on an alert? Captured via the Telegram cockpit. */
export interface ReplyActionRow {
    tweetId: string;
    replied: boolean;
    repliedAt?: number;
    replyTweetId?: string;    // the user's own reply id (cheap $0.001 owned read)
    usedDraft?: boolean;      // did they use an Opus draft (V2 attribution)
    latencyMs?: number;       // repliedAt - alertedAt (acting speed)
}

/** Engagement on a reply, refreshed by the daily owned-read sweep. */
export interface ReplyOutcomeRow {
    replyTweetId: string;
    measuredAt: number;
    likes: number;
    replies: number;
    retweets: number;
    impressions: number;
}

/** Daily follower count — the headline trend, with baseline context. */
export interface FollowerSnapshotRow {
    day: string;              // 'YYYY-MM-DD' (UTC)
    followerCount: number;
    followingCount?: number;
    repliesSentToday?: number;
    alertsSentToday?: number;
}

/** Rolled-up funnel for the readout. */
export interface FunnelStats {
    alerts: number;
    replied: number;
    replyRate: number;        // replied / alerts
    usedDraft: number;
    avgScore: number;
}
