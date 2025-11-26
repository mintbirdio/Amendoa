/**
 * Gamification Service
 *
 * Handles XP calculation, streak management, and tier/rank progression.
 * Transforms Amendoa from a passive tool into an active habit engine.
 */

import {
    db,
    type GamificationProgress,
    type UserGamificationStats,
    type GamificationTier,
    getTodayDate,
    getLocalDateString,
    getOrCreateTodayGamificationProgress,
    getOrCreateUserGamificationStats
} from '../db';

// =============================================================================
// CONSTANTS
// =============================================================================

// XP values for input actions
export const XP_VALUES = {
    reply: 4,
    post: 15,
    conversationContinued: 20,
    replyBack: 25,
    authorLike: 8,
    replyFivePlusLikes: 15,
    newFollower: 50,
    newMutual: 100
} as const;

// Daily requirements for streak maintenance
export const DAILY_REQUIREMENTS = {
    minReplies: 25,
    minPosts: 3,
    maxRewardedPosts: 5
} as const;

// Tier definitions with XP thresholds
export const TIERS: Array<{
    name: GamificationTier;
    emoji: string;
    minXP: number;
}> = [
    { name: 'Lurker', emoji: '👀', minXP: 0 },
    { name: 'Reply Guy', emoji: '💬', minXP: 1500 },
    { name: 'Engager', emoji: '🎯', minXP: 5000 },
    { name: 'Networker', emoji: '🤝', minXP: 15000 },
    { name: 'Voice', emoji: '📢', minXP: 40000 },
    { name: 'Authority', emoji: '⭐', minXP: 100000 },
    { name: 'Thought Leader', emoji: '👑', minXP: 300000 }
];

// Streak multiplier thresholds
const STREAK_MULTIPLIERS: Array<{ minDays: number; multiplier: number }> = [
    { minDays: 30, multiplier: 2.0 },
    { minDays: 14, multiplier: 1.5 },
    { minDays: 7, multiplier: 1.25 },
    { minDays: 3, multiplier: 1.1 },
    { minDays: 0, multiplier: 1.0 }
];

// =============================================================================
// TYPES
// =============================================================================

export type GamificationAction =
    | 'reply'
    | 'post'
    | 'conversationContinued'
    | 'replyBack'
    | 'authorLike'
    | 'replyFivePlusLikes'
    | 'newFollower'
    | 'newMutual';

export interface TierRankInfo {
    tier: GamificationTier;
    emoji: string;
    rank: string;
    display: string;
    xpIntoRank: number;
    xpForNextRank: number;
    progressPercent: number;
}

export interface RecordActionResult {
    xpEarned: number;
    baseXP: number;
    multiplier: number;
    newTotalXP: number;
    rankInfo: TierRankInfo;
    previousRankInfo: TierRankInfo;
    didRankUp: boolean;
    streakMaintained: boolean;
}

// =============================================================================
// STREAK & MULTIPLIER FUNCTIONS
// =============================================================================

/**
 * Get the streak multiplier for a given streak length
 */
export function getStreakMultiplier(streakDays: number): number {
    for (const tier of STREAK_MULTIPLIERS) {
        if (streakDays >= tier.minDays) {
            return tier.multiplier;
        }
    }
    return 1.0;
}

/**
 * Calculate number of days between two date strings (YYYY-MM-DD)
 */
export function daysBetween(dateStr1: string, dateStr2: string): number {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check and update streak on session start
 * Call this when the extension loads
 */
export async function checkStreakOnLoad(): Promise<{
    streakBroken: boolean;
    previousStreak: number;
    currentStreak: number;
}> {
    const today = getTodayDate();
    const stats = await getOrCreateUserGamificationStats();
    const lastActiveDate = stats.lastActiveDate;

    const result = {
        streakBroken: false,
        previousStreak: stats.currentStreak,
        currentStreak: stats.currentStreak
    };

    // First time user or no activity yet
    if (!lastActiveDate) {
        return result;
    }

    const daysSinceActive = daysBetween(lastActiveDate, today);

    // Same day - continue
    if (daysSinceActive === 0) {
        return result;
    }

    // Yesterday - check if requirements were met
    if (daysSinceActive === 1) {
        const yesterdayProgress = await db.gamificationProgress.get(lastActiveDate);
        if (yesterdayProgress && yesterdayProgress.streakMaintained) {
            // Streak continues - increment it
            const newStreak = stats.currentStreak + 1;
            await db.userGamificationStats.update('main', {
                currentStreak: newStreak,
                longestStreak: Math.max(stats.longestStreak, newStreak),
                updatedAt: Date.now()
            });
            result.currentStreak = newStreak;
            return result;
        } else {
            // Requirements not met - break streak
            await db.userGamificationStats.update('main', {
                currentStreak: 0,
                updatedAt: Date.now()
            });
            result.streakBroken = true;
            result.currentStreak = 0;
            return result;
        }
    }

    // Missed a day entirely - break streak
    if (daysSinceActive > 1) {
        await db.userGamificationStats.update('main', {
            currentStreak: 0,
            updatedAt: Date.now()
        });
        result.streakBroken = true;
        result.currentStreak = 0;
        return result;
    }

    return result;
}

// =============================================================================
// TIER & RANK FUNCTIONS
// =============================================================================

/**
 * Convert a number to Roman numeral (for rank display)
 */
export function toRomanNumeral(num: number): string {
    if (num <= 0) return '';
    if (num <= 10) {
        return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][num];
    }
    // For larger numbers, just use the number
    return num.toString();
}

/**
 * Calculate tier and rank from total XP
 */
export function getTierAndRank(totalXP: number): TierRankInfo {
    // Find current tier
    let tierIndex = 0;
    for (let i = TIERS.length - 1; i >= 0; i--) {
        if (totalXP >= TIERS[i].minXP) {
            tierIndex = i;
            break;
        }
    }

    const tier = TIERS[tierIndex];

    // Handle Thought Leader (infinite scaling)
    if (tierIndex === TIERS.length - 1) {
        const thoughtLeaderXP = totalXP - 300000;
        const rankNum = Math.floor(thoughtLeaderXP / 100000) + 1;
        const xpIntoRank = thoughtLeaderXP % 100000;
        return {
            tier: tier.name,
            emoji: tier.emoji,
            rank: toRomanNumeral(rankNum),
            display: `${tier.emoji} ${tier.name} ${toRomanNumeral(rankNum)}`,
            xpIntoRank,
            xpForNextRank: 100000,
            progressPercent: (xpIntoRank / 100000) * 100
        };
    }

    // Normal tiers - calculate rank I, II, or III
    const nextTierXP = TIERS[tierIndex + 1].minXP;
    const tierSpan = nextTierXP - tier.minXP;
    const xpIntoTier = totalXP - tier.minXP;
    const progress = xpIntoTier / tierSpan;

    let rank: string;
    let xpIntoRank: number;
    let xpForNextRank: number;
    const rankSpan = tierSpan / 3;

    if (progress < 0.333) {
        rank = 'I';
        xpIntoRank = xpIntoTier;
        xpForNextRank = rankSpan;
    } else if (progress < 0.666) {
        rank = 'II';
        xpIntoRank = xpIntoTier - rankSpan;
        xpForNextRank = rankSpan;
    } else {
        rank = 'III';
        xpIntoRank = xpIntoTier - (rankSpan * 2);
        xpForNextRank = rankSpan;
    }

    return {
        tier: tier.name,
        emoji: tier.emoji,
        rank,
        display: `${tier.emoji} ${tier.name} ${rank}`,
        xpIntoRank: Math.floor(xpIntoRank),
        xpForNextRank: Math.floor(xpForNextRank),
        progressPercent: (xpIntoRank / xpForNextRank) * 100
    };
}

// =============================================================================
// XP CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate XP for an action, respecting daily caps
 */
export function calculateActionXP(
    action: GamificationAction,
    dailyProgress: GamificationProgress
): number {
    // Posts are capped at 5 per day for XP
    if (action === 'post' && dailyProgress.postsPublished >= DAILY_REQUIREMENTS.maxRewardedPosts) {
        return 0;
    }
    return XP_VALUES[action] || 0;
}

/**
 * Check if daily requirements are met for streak
 */
export function checkStreakRequirements(progress: GamificationProgress): boolean {
    return (
        progress.repliesSent >= DAILY_REQUIREMENTS.minReplies &&
        progress.postsPublished >= DAILY_REQUIREMENTS.minPosts
    );
}

// =============================================================================
// MAIN ACTION RECORDING
// =============================================================================

/**
 * Record a gamification action and update all stats
 */
export async function recordGamificationAction(
    action: GamificationAction
): Promise<RecordActionResult> {
    const today = getTodayDate();
    const userStats = await getOrCreateUserGamificationStats();
    const dailyProgress = await getOrCreateTodayGamificationProgress();
    const multiplier = getStreakMultiplier(userStats.currentStreak);

    // Get previous rank info for comparison
    const previousRankInfo = getTierAndRank(userStats.totalXP);

    // Calculate XP
    const baseXP = calculateActionXP(action, dailyProgress);
    const earnedXP = Math.floor(baseXP * multiplier);

    // Update daily progress counters
    const updates: Partial<GamificationProgress> = {};

    switch (action) {
        case 'reply':
            updates.repliesSent = dailyProgress.repliesSent + 1;
            break;
        case 'post':
            updates.postsPublished = dailyProgress.postsPublished + 1;
            break;
        case 'conversationContinued':
            updates.conversationsContinued = dailyProgress.conversationsContinued + 1;
            break;
        case 'replyBack':
            updates.replyBacksReceived = dailyProgress.replyBacksReceived + 1;
            break;
        case 'authorLike':
            updates.authorLikesReceived = dailyProgress.authorLikesReceived + 1;
            break;
        case 'replyFivePlusLikes':
            updates.repliesWithFivePlusLikes = dailyProgress.repliesWithFivePlusLikes + 1;
            break;
        case 'newFollower':
            updates.newFollowers = dailyProgress.newFollowers + 1;
            break;
        case 'newMutual':
            updates.newMutuals = dailyProgress.newMutuals + 1;
            break;
    }

    // Update XP totals
    updates.baseXPEarned = dailyProgress.baseXPEarned + baseXP;
    updates.multiplier = multiplier;
    updates.totalXPEarned = dailyProgress.totalXPEarned + earnedXP;

    // Merge updates with current progress for streak check
    const updatedProgress = { ...dailyProgress, ...updates };
    updates.streakMaintained = checkStreakRequirements(updatedProgress);

    await db.gamificationProgress.update(today, updates);

    // Update user stats
    const newTotalXP = userStats.totalXP + earnedXP;
    const newRankInfo = getTierAndRank(newTotalXP);

    // Check for rank up
    const didRankUp =
        previousRankInfo.tier !== newRankInfo.tier ||
        previousRankInfo.rank !== newRankInfo.rank;

    // Prepare lifetime stat updates
    const lifetimeUpdates: Partial<UserGamificationStats> = {
        totalXP: newTotalXP,
        lastActiveDate: today,
        currentTier: newRankInfo.tier,
        currentRank: newRankInfo.rank,
        currentTierEmoji: newRankInfo.emoji,
        updatedAt: Date.now()
    };

    // Update lifetime counters
    switch (action) {
        case 'reply':
            lifetimeUpdates.totalReplies = userStats.totalReplies + 1;
            break;
        case 'post':
            lifetimeUpdates.totalPosts = userStats.totalPosts + 1;
            break;
        case 'conversationContinued':
            lifetimeUpdates.totalConversations = userStats.totalConversations + 1;
            break;
        case 'replyBack':
            lifetimeUpdates.totalReplyBacks = userStats.totalReplyBacks + 1;
            break;
        case 'newFollower':
        case 'newMutual':
            lifetimeUpdates.totalFollowersGained = userStats.totalFollowersGained + 1;
            break;
    }

    await db.userGamificationStats.update('main', lifetimeUpdates);

    return {
        xpEarned: earnedXP,
        baseXP,
        multiplier,
        newTotalXP,
        rankInfo: newRankInfo,
        previousRankInfo,
        didRankUp,
        streakMaintained: updates.streakMaintained!
    };
}

// =============================================================================
// STATS RETRIEVAL
// =============================================================================

/**
 * Get complete gamification status for UI display
 */
export interface GamificationStatus {
    // User stats
    totalXP: number;
    currentStreak: number;
    longestStreak: number;
    rankInfo: TierRankInfo;
    multiplier: number;

    // Today's progress
    todayReplies: number;
    todayPosts: number;
    todayXP: number;
    streakSafe: boolean;
    repliesNeeded: number;
    postsNeeded: number;

    // Today's bonuses
    todayReplyBacks: number;
    todayAuthorLikes: number;
    todayNewFollowers: number;

    // Lifetime stats
    totalReplies: number;
    totalPosts: number;
    totalReplyBacks: number;
    totalFollowersGained: number;
}

export async function getGamificationStatus(): Promise<GamificationStatus> {
    const userStats = await getOrCreateUserGamificationStats();
    const todayProgress = await getOrCreateTodayGamificationProgress();

    const multiplier = getStreakMultiplier(userStats.currentStreak);
    const rankInfo = getTierAndRank(userStats.totalXP);

    const repliesNeeded = Math.max(0, DAILY_REQUIREMENTS.minReplies - todayProgress.repliesSent);
    const postsNeeded = Math.max(0, DAILY_REQUIREMENTS.minPosts - todayProgress.postsPublished);

    return {
        totalXP: userStats.totalXP,
        currentStreak: userStats.currentStreak,
        longestStreak: userStats.longestStreak,
        rankInfo,
        multiplier,

        todayReplies: todayProgress.repliesSent,
        todayPosts: todayProgress.postsPublished,
        todayXP: todayProgress.totalXPEarned,
        streakSafe: todayProgress.streakMaintained,
        repliesNeeded,
        postsNeeded,

        todayReplyBacks: todayProgress.replyBacksReceived,
        todayAuthorLikes: todayProgress.authorLikesReceived,
        todayNewFollowers: todayProgress.newFollowers,

        totalReplies: userStats.totalReplies,
        totalPosts: userStats.totalPosts,
        totalReplyBacks: userStats.totalReplyBacks,
        totalFollowersGained: userStats.totalFollowersGained
    };
}

/**
 * Get weekly stats for the past 7 days
 */
export interface WeeklyStats {
    weekStart: string;
    weekEnd: string;
    totalXP: number;
    totalReplies: number;
    totalPosts: number;
    totalReplyBacks: number;
    totalNewFollowers: number;
    daysActive: number;
    dailyBreakdown: Array<{
        date: string;
        xp: number;
        replies: number;
        posts: number;
        streakMaintained: boolean;
    }>;
}

export async function getWeeklyStats(): Promise<WeeklyStats> {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const weekStart = getLocalDateString(weekAgo);
    const weekEnd = getLocalDateString(today);

    // Get all progress records for the week
    const progressRecords = await db.gamificationProgress
        .where('date')
        .between(weekStart, weekEnd, true, true)
        .toArray();

    const dailyBreakdown = progressRecords.map(p => ({
        date: p.date,
        xp: p.totalXPEarned,
        replies: p.repliesSent,
        posts: p.postsPublished,
        streakMaintained: p.streakMaintained
    }));

    return {
        weekStart,
        weekEnd,
        totalXP: progressRecords.reduce((sum, p) => sum + p.totalXPEarned, 0),
        totalReplies: progressRecords.reduce((sum, p) => sum + p.repliesSent, 0),
        totalPosts: progressRecords.reduce((sum, p) => sum + p.postsPublished, 0),
        totalReplyBacks: progressRecords.reduce((sum, p) => sum + p.replyBacksReceived, 0),
        totalNewFollowers: progressRecords.reduce((sum, p) => sum + p.newFollowers, 0),
        daysActive: progressRecords.length,
        dailyBreakdown
    };
}

// =============================================================================
// MANUAL INPUT (for outcomes that can't be auto-detected)
// =============================================================================

/**
 * Manually add new followers (since we can't auto-detect this reliably)
 */
export async function addNewFollowers(count: number): Promise<RecordActionResult | null> {
    if (count <= 0) return null;

    let result: RecordActionResult | null = null;
    for (let i = 0; i < count; i++) {
        result = await recordGamificationAction('newFollower');
    }
    return result;
}

/**
 * Manually add new mutuals
 */
export async function addNewMutuals(count: number): Promise<RecordActionResult | null> {
    if (count <= 0) return null;

    let result: RecordActionResult | null = null;
    for (let i = 0; i < count; i++) {
        result = await recordGamificationAction('newMutual');
    }
    return result;
}
