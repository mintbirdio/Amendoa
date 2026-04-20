import Dexie, { type Table } from 'dexie';

// =============================================================================
// TYPES
// =============================================================================

export type Tier = 'titan' | 'star' | 'rising' | 'emerging' | 'peer';
export type RelationshipStatus = 'mutual' | 'following' | 'follower' | 'none';
export type ScoreBadge = 'hot' | 'high' | 'good' | 'meh' | 'skip';

// Gamification tier names
export type GamificationTier = 'Lurker' | 'Reply Guy' | 'Engager' | 'Networker' | 'Voice' | 'Authority' | 'Thought Leader';

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
export type ReplySource = 'amendoa' | 'native';

export interface OurReply {
    replyId: string;                   // primary key
    inReplyToTweetId: string;
    inReplyToHandle: string;           // lowercase
    repliedAt: number;
    content: string;

    // Reply log context (v10)
    source: ReplySource;
    originalTweetContent: string;
    originalPostedAt: number;
    authorFollowerCountAtReply: number;
    draftText: string;

    // Performance tracking
    likesReceived: number;
    repliesReceived: number;
    gotAuthorReply: boolean;
    authorReplyTimestamp: number | null;
    authorLiked: boolean;
    lastPolledAt: number | null;
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
// GAMIFICATION INTERFACES
// =============================================================================

/**
 * GamificationProgress - daily progress for XP/streak tracking
 */
export interface GamificationProgress {
    date: string;                      // "YYYY-MM-DD" (primary key, local date)

    // Input actions (user controls these)
    repliesSent: number;
    postsPublished: number;
    conversationsContinued: number;    // replied to someone who replied to them

    // Output bonuses (other users' actions)
    replyBacksReceived: number;
    authorLikesReceived: number;
    repliesWithFivePlusLikes: number;
    newFollowers: number;
    newMutuals: number;

    // Calculated XP
    baseXPEarned: number;              // before multiplier
    multiplier: number;                // streak multiplier that day
    totalXPEarned: number;             // base × multiplier

    // Requirements check
    streakMaintained: boolean;         // did user hit 25 replies + 3 posts?
}

/**
 * UserGamificationStats - persistent user gamification stats
 */
export interface UserGamificationStats {
    id: string;                        // always "main" (singleton)
    totalXP: number;
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;            // "YYYY-MM-DD"

    // Current tier/rank (derived, cached for performance)
    currentTier: GamificationTier;
    currentRank: string;               // "I", "II", "III", etc.
    currentTierEmoji: string;

    // Lifetime stats
    totalReplies: number;
    totalPosts: number;
    totalConversations: number;
    totalReplyBacks: number;
    totalFollowersGained: number;

    // Timestamps
    createdAt: number;
    updatedAt: number;
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
    // Gamification tables
    gamificationProgress!: Table<GamificationProgress>;
    userGamificationStats!: Table<UserGamificationStats>;

    constructor() {
        super('AmendoaDB');

        // v7: Complete schema rewrite for Amendoa
        // Drops all legacy tables and creates new structure
        this.version(7).stores({
            // Drop old tables by setting to null
            velocityCache: null,
            userInteractions: null,
            growthMetrics: null,
            styleExamples: null,

            // Core tables
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

        // v9: Add Gamification System
        // New tables: gamificationProgress, userGamificationStats
        this.version(9).stores({
            targetAccounts: 'handle, tier, lastInteraction, addedAt',
            tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
            ourReplies: 'replyId, inReplyToHandle, repliedAt',
            conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
            dailyStats: 'date',
            settings: 'key',
            gamificationProgress: 'date',
            userGamificationStats: 'id'
        });

        // v10: Reply log enrichment — source + original tweet snapshot on ourReplies
        this.version(10).stores({
            targetAccounts: 'handle, tier, lastInteraction, addedAt',
            tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
            ourReplies: 'replyId, inReplyToHandle, repliedAt, source',
            conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
            dailyStats: 'date',
            settings: 'key',
            gamificationProgress: 'date',
            userGamificationStats: 'id'
        }).upgrade(async tx => {
            try {
                return await tx.table('ourReplies').toCollection().modify(reply => {
                    try {
                        reply.source = reply.source ?? 'native';
                        reply.originalTweetContent = reply.originalTweetContent ?? '';
                        reply.originalPostedAt = reply.originalPostedAt ?? 0;
                        reply.authorFollowerCountAtReply = reply.authorFollowerCountAtReply ?? 0;
                        reply.draftText = reply.draftText ?? '';
                        reply.authorLiked = reply.authorLiked ?? false;
                        reply.lastPolledAt = reply.lastPolledAt ?? null;
                    } catch (rowError) {
                        console.error(
                            '[Amendoa] Dexie v10 upgrade: failed to backfill row',
                            reply?.replyId,
                            rowError
                        );
                        // Best-effort defaults so the row still satisfies the v10 shape.
                        if (typeof reply === 'object' && reply !== null) {
                            if (reply.source === undefined) reply.source = 'native';
                            if (reply.originalTweetContent === undefined) reply.originalTweetContent = '';
                            if (reply.originalPostedAt === undefined) reply.originalPostedAt = 0;
                            if (reply.authorFollowerCountAtReply === undefined) reply.authorFollowerCountAtReply = 0;
                            if (reply.draftText === undefined) reply.draftText = '';
                            if (reply.authorLiked === undefined) reply.authorLiked = false;
                            if (reply.lastPolledAt === undefined) reply.lastPolledAt = null;
                        }
                    }
                });
            } catch (error) {
                console.error('[Amendoa] Dexie v10 upgrade failed', error);
                throw error;
            }
        });
    }
}

export const db = new AmendoaDB();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get today's date in YYYY-MM-DD format (LOCAL timezone)
 * Uses toLocaleDateString with 'en-CA' locale for YYYY-MM-DD format
 */
export function getTodayDate(): string {
    return new Date().toLocaleDateString('en-CA');
}

/**
 * Get local date string for any Date object
 */
export function getLocalDateString(date: Date): string {
    return date.toLocaleDateString('en-CA');
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

// =============================================================================
// GAMIFICATION HELPER FUNCTIONS
// =============================================================================

/**
 * Create an empty GamificationProgress record for a date
 */
export function createEmptyGamificationProgress(date: string): GamificationProgress {
    return {
        date,
        repliesSent: 0,
        postsPublished: 0,
        conversationsContinued: 0,
        replyBacksReceived: 0,
        authorLikesReceived: 0,
        repliesWithFivePlusLikes: 0,
        newFollowers: 0,
        newMutuals: 0,
        baseXPEarned: 0,
        multiplier: 1.0,
        totalXPEarned: 0,
        streakMaintained: false
    };
}

/**
 * Create initial UserGamificationStats
 */
export function createInitialUserGamificationStats(): UserGamificationStats {
    const now = Date.now();
    return {
        id: 'main',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: '',
        currentTier: 'Lurker',
        currentRank: 'I',
        currentTierEmoji: '👀',
        totalReplies: 0,
        totalPosts: 0,
        totalConversations: 0,
        totalReplyBacks: 0,
        totalFollowersGained: 0,
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Get or create today's gamification progress
 */
export async function getOrCreateTodayGamificationProgress(): Promise<GamificationProgress> {
    const today = getTodayDate();
    let progress = await db.gamificationProgress.get(today);

    if (!progress) {
        progress = createEmptyGamificationProgress(today);
        await db.gamificationProgress.add(progress);
    }

    return progress;
}

/**
 * Get or create user gamification stats (singleton)
 */
export async function getOrCreateUserGamificationStats(): Promise<UserGamificationStats> {
    let stats = await db.userGamificationStats.get('main');

    if (!stats) {
        stats = createInitialUserGamificationStats();
        await db.userGamificationStats.add(stats);
    }

    return stats;
}
