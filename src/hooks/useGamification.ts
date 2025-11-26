/**
 * useGamification Hook
 *
 * React hook for accessing gamification status and real-time updates.
 */

import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getTodayDate } from '../db';
import {
    type GamificationStatus,
    type TierRankInfo,
    getTierAndRank,
    getStreakMultiplier,
    DAILY_REQUIREMENTS
} from '../services/gamification';

/**
 * Default status for initial render
 */
const DEFAULT_STATUS: GamificationStatus = {
    totalXP: 0,
    currentStreak: 0,
    longestStreak: 0,
    rankInfo: {
        tier: 'Lurker',
        emoji: '👀',
        rank: 'I',
        display: '👀 Lurker I',
        xpIntoRank: 0,
        xpForNextRank: 500,
        progressPercent: 0
    },
    multiplier: 1.0,
    todayReplies: 0,
    todayPosts: 0,
    todayXP: 0,
    streakSafe: false,
    repliesNeeded: DAILY_REQUIREMENTS.minReplies,
    postsNeeded: DAILY_REQUIREMENTS.minPosts,
    todayReplyBacks: 0,
    todayAuthorLikes: 0,
    todayNewFollowers: 0,
    totalReplies: 0,
    totalPosts: 0,
    totalReplyBacks: 0,
    totalFollowersGained: 0
};

/**
 * Main hook for gamification status
 * Subscribes to database changes for real-time updates
 */
export function useGamificationStatus(): GamificationStatus {
    const today = getTodayDate();

    // Live query for today's progress
    const todayProgress = useLiveQuery(
        () => db.gamificationProgress.get(today),
        [today]
    );

    // Live query for user stats
    const userStats = useLiveQuery(
        () => db.userGamificationStats.get('main'),
        []
    );

    // Calculate derived status
    if (!userStats || !todayProgress) {
        return DEFAULT_STATUS;
    }

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
 * Hook for just the rank info (lighter weight)
 */
export function useRankInfo(): TierRankInfo {
    const userStats = useLiveQuery(
        () => db.userGamificationStats.get('main'),
        []
    );

    if (!userStats) {
        return DEFAULT_STATUS.rankInfo;
    }

    return getTierAndRank(userStats.totalXP);
}

/**
 * Hook for daily requirements progress
 */
export function useDailyRequirements(): {
    repliesSent: number;
    repliesRequired: number;
    repliesProgress: number;
    postsSent: number;
    postsRequired: number;
    postsProgress: number;
    isStreakSafe: boolean;
} {
    const today = getTodayDate();

    const todayProgress = useLiveQuery(
        () => db.gamificationProgress.get(today),
        [today]
    );

    if (!todayProgress) {
        return {
            repliesSent: 0,
            repliesRequired: DAILY_REQUIREMENTS.minReplies,
            repliesProgress: 0,
            postsSent: 0,
            postsRequired: DAILY_REQUIREMENTS.minPosts,
            postsProgress: 0,
            isStreakSafe: false
        };
    }

    return {
        repliesSent: todayProgress.repliesSent,
        repliesRequired: DAILY_REQUIREMENTS.minReplies,
        repliesProgress: Math.min(100, (todayProgress.repliesSent / DAILY_REQUIREMENTS.minReplies) * 100),
        postsSent: todayProgress.postsPublished,
        postsRequired: DAILY_REQUIREMENTS.minPosts,
        postsProgress: Math.min(100, (todayProgress.postsPublished / DAILY_REQUIREMENTS.minPosts) * 100),
        isStreakSafe: todayProgress.streakMaintained
    };
}

/**
 * Hook that listens for XP earned events and triggers UI updates
 */
export function useXPEarnedListener(onXPEarned?: (detail: { action: string; xpEarned: number; didRankUp: boolean }) => void): void {
    useEffect(() => {
        const handler = (event: CustomEvent) => {
            onXPEarned?.(event.detail);
        };

        window.addEventListener('AMENDOA_XP_EARNED', handler as EventListener);
        return () => window.removeEventListener('AMENDOA_XP_EARNED', handler as EventListener);
    }, [onXPEarned]);
}

/**
 * Hook that listens for streak broken events
 */
export function useStreakBrokenListener(onStreakBroken?: (detail: { previousStreak: number }) => void): void {
    useEffect(() => {
        const handler = (event: CustomEvent) => {
            onStreakBroken?.(event.detail);
        };

        window.addEventListener('AMENDOA_STREAK_BROKEN', handler as EventListener);
        return () => window.removeEventListener('AMENDOA_STREAK_BROKEN', handler as EventListener);
    }, [onStreakBroken]);
}
