import Dexie, { type Table } from 'dexie';

// =============================================================================
// TYPES
// =============================================================================

export type Tier = 'titan' | 'star' | 'rising' | 'emerging' | 'peer';
export type RelationshipStatus = 'mutual' | 'following' | 'follower' | 'none';
export type ScoreBadge = 'hot' | 'high' | 'good' | 'meh' | 'skip';

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * TargetAccounts - accounts we're actively tracking for reply opportunities
 */
export interface TargetAccount {
    handle: string;                    // @username (primary key, lowercase)
    displayName: string;
    followerCount: number;
    followingCount: number;
    isPremium: boolean;
    tier: Tier;
    relationshipStatus: RelationshipStatus;
    lastInteraction: number | null;    // timestamp of last interaction
    interactionCount: number;          // times they've engaged with us
    ourEngagementCount: number;        // times we've engaged with them
    replyBackRate: number;             // % of our replies they respond to (0-100)
    addedAt: number;                   // timestamp when added
    notes: string;                     // user can add context
    notificationsEnabled: boolean;     // alert when they post
}

/**
 * TweetCache - tweets we've seen and scored
 */
export interface TweetCache {
    tweetId: string;                   // primary key
    authorHandle: string;              // lowercase
    content: string;
    postedAt: number;                  // extracted from snowflake ID
    firstSeenAt: number;               // when we first saw it

    // Tweet metadata
    hasMedia: boolean;
    isThread: boolean;
    isReply: boolean;

    // Latest engagement snapshot
    likes: number;
    retweets: number;
    replies: number;
    views: number;

    // Calculated score
    opportunityScore: number;
    scoreBadge: ScoreBadge;

    // Our interaction
    didReply: boolean;
    replyTimestamp: number | null;
    gotReplyBack: boolean;

    // Discovery feature - added in v8
    isFromTarget: boolean;             // true if author is in targets list
    authorFollowerCount: number;       // for Discovery scoring/display
    authorIsPremium: boolean;          // for Discovery display
}

/**
 * OurReplies - track replies we've sent for performance analysis
 */
export interface OurReply {
    replyId: string;                   // primary key
    inReplyToTweetId: string;
    inReplyToHandle: string;           // lowercase
    repliedAt: number;
    content: string;

    // Performance tracking
    likesReceived: number;
    repliesReceived: number;
    gotAuthorReply: boolean;
    authorReplyTimestamp: number | null;
}

/**
 * Conversation - tracks conversation threads and obligations
 */
export interface Conversation {
    id: string;                        // primary key (composite of handles + thread)
    otherPartyHandle: string;          // lowercase
    otherPartyTier: Tier | null;       // null if not a target
    lastMessageFrom: 'us' | 'them';
    lastMessageAt: number;
    lastMessagePreview: string;        // first ~100 chars
    threadUrl: string;
    isObligation: boolean;             // true if they replied and we haven't
    isDismissed: boolean;              // user dismissed this obligation
}

/**
 * DailyStats - daily performance metrics
 */
export interface DailyStats {
    date: string;                      // YYYY-MM-DD (primary key)
    repliesSent: number;
    repliesGotResponse: number;
    conversationsStarted: number;
    conversationsContinued: number;
    firstResponderCount: number;       // times we were in first 5 replies
}

/**
 * Settings - user preferences
 */
export interface Settings {
    key: string;                       // setting key (primary key)
    value: string;                     // JSON stringified value
}

// =============================================================================
// DATABASE CLASS
// =============================================================================

export class AmendoaDB extends Dexie {
    targetAccounts!: Table<TargetAccount>;
    tweetCache!: Table<TweetCache>;
    ourReplies!: Table<OurReply>;
    conversations!: Table<Conversation>;
    dailyStats!: Table<DailyStats>;
    settings!: Table<Settings>;

    constructor() {
        super('AmendoaDB');

        // v7: Complete schema rewrite for Amendoa v2
        // Drops all v1 tables and creates new structure
        this.version(7).stores({
            // Drop old tables by setting to null
            velocityCache: null,
            userInteractions: null,
            growthMetrics: null,
            styleExamples: null,

            // New v2 tables
            targetAccounts: 'handle, tier, lastInteraction, addedAt',
            tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore',
            ourReplies: 'replyId, inReplyToHandle, repliedAt',
            conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
            dailyStats: 'date',
            settings: 'key'
        });

        // v8: Add Discovery Queue support
        // New fields: isFromTarget, authorFollowerCount, authorIsPremium
        this.version(8).stores({
            targetAccounts: 'handle, tier, lastInteraction, addedAt',
            tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
            ourReplies: 'replyId, inReplyToHandle, repliedAt',
            conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
            dailyStats: 'date',
            settings: 'key'
        }).upgrade(tx => {
            // Migrate existing tweets - assume all existing are from targets
            return tx.table('tweetCache').toCollection().modify(tweet => {
                tweet.isFromTarget = true;
                tweet.authorFollowerCount = tweet.authorFollowerCount ?? 0;
                tweet.authorIsPremium = tweet.authorIsPremium ?? false;
            });
        });
    }
}

export const db = new AmendoaDB();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

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

/**
 * Get or create today's stats
 */
export async function getOrCreateTodayStats(): Promise<DailyStats> {
    const today = getTodayDate();
    let stats = await db.dailyStats.get(today);

    if (!stats) {
        stats = {
            date: today,
            repliesSent: 0,
            repliesGotResponse: 0,
            conversationsStarted: 0,
            conversationsContinued: 0,
            firstResponderCount: 0
        };
        await db.dailyStats.add(stats);
    }

    return stats;
}

/**
 * Increment a daily stat
 */
export async function incrementDailyStat(
    field: keyof Omit<DailyStats, 'date'>,
    amount: number = 1
): Promise<void> {
    const stats = await getOrCreateTodayStats();
    await db.dailyStats.update(stats.date, {
        [field]: (stats[field] as number) + amount
    });
}

/**
 * Clean up old data (call periodically)
 */
export async function cleanupOldData(): Promise<void> {
    const now = Date.now();
    const TWEET_RETENTION = 7 * 24 * 60 * 60 * 1000;      // 7 days
    const CONVERSATION_RETENTION = 30 * 24 * 60 * 60 * 1000; // 30 days
    const REPLY_RETENTION = 90 * 24 * 60 * 60 * 1000;     // 90 days

    // Clean old tweets
    await db.tweetCache
        .where('firstSeenAt')
        .below(now - TWEET_RETENTION)
        .delete();

    // Clean old dismissed conversations
    await db.conversations
        .where('lastMessageAt')
        .below(now - CONVERSATION_RETENTION)
        .and(c => c.isDismissed)
        .delete();

    // Clean old replies (keep for analytics)
    await db.ourReplies
        .where('repliedAt')
        .below(now - REPLY_RETENTION)
        .delete();
}
