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
        tierNumber: 1,
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
    repliesGoalMet: false,
    postsGoalMet: false,
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

    // If user stats don't exist yet, return defaults
    if (!userStats) {
        return DEFAULT_STATUS;
    }

    // User stats exist - use them even if today's progress doesn't exist yet
    // Today's progress being empty just means no activity today (which is fine)
    const multiplier = getStreakMultiplier(userStats.currentStreak);
    const rankInfo = getTierAndRank(userStats.totalXP);

    // Use today's progress if it exists, otherwise use zeros for daily counters
    const todayReplies = todayProgress?.repliesSent ?? 0;
    const todayPosts = todayProgress?.postsPublished ?? 0;
    const todayXP = todayProgress?.totalXPEarned ?? 0;

    const repliesNeeded = Math.max(0, DAILY_REQUIREMENTS.minReplies - todayReplies);
    const postsNeeded = Math.max(0, DAILY_REQUIREMENTS.minPosts - todayPosts);

    // streakSafe = any activity today (not goals)
    const hasActivity = todayReplies > 0 || todayPosts > 0;

    return {
        totalXP: userStats.totalXP,
        currentStreak: userStats.currentStreak,
        longestStreak: userStats.longestStreak,
        rankInfo,
        multiplier,

        todayReplies,
        todayPosts,
        todayXP,
        streakSafe: hasActivity,
        repliesGoalMet: todayReplies >= DAILY_REQUIREMENTS.minReplies,
        postsGoalMet: todayPosts >= DAILY_REQUIREMENTS.minPosts,
        repliesNeeded,
        postsNeeded,

        todayReplyBacks: todayProgress?.replyBacksReceived ?? 0,
        todayAuthorLikes: todayProgress?.authorLikesReceived ?? 0,
        todayNewFollowers: todayProgress?.newFollowers ?? 0,

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
