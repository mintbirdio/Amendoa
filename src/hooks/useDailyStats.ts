/**
 * useDailyStats Hook
 *
 * React hook for accessing daily performance statistics.
 */

import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DailyStats, getTodayDate } from '../db';

// Default stats for today
const DEFAULT_STATS: DailyStats = {
    date: getTodayDate(),
    repliesSent: 0,
    repliesGotResponse: 0,
    conversationsStarted: 0,
    conversationsContinued: 0,
    firstResponderCount: 0
};

/**
 * Ensure today's stats exist (call outside of liveQuery)
 */
async function ensureTodayStats(): Promise<void> {
    const today = getTodayDate();
    const existing = await db.dailyStats.get(today);
    if (!existing) {
        await db.dailyStats.add({
            date: today,
            repliesSent: 0,
            repliesGotResponse: 0,
            conversationsStarted: 0,
            conversationsContinued: 0,
            firstResponderCount: 0
        });
    }
}

/**
 * Get today's stats
 */
export function useTodayStats(): DailyStats {
    const today = getTodayDate();

    // Ensure stats exist on mount (outside of liveQuery)
    useEffect(() => {
        ensureTodayStats();
    }, []);

    // Read-only query
    const stats = useLiveQuery(
        () => db.dailyStats.get(today),
        [today]
    );

    // Return stats or defaults
    return stats || { ...DEFAULT_STATS, date: today };
}

/**
 * Get stats for the last N days
 */
export function useStatsHistory(days: number = 7): DailyStats[] {
    return useLiveQuery(
        async () => {
            const stats = await db.dailyStats
                .orderBy('date')
                .reverse()
                .limit(days)
                .toArray();

            return stats.reverse(); // Oldest first
        },
        [days],
        []
    );
}

/**
 * Get response rate (percentage of replies that got a response)
 */
export function useResponseRate(): number {
    const stats = useTodayStats();

    if (stats.repliesSent === 0) return 0;
    return Math.round((stats.repliesGotResponse / stats.repliesSent) * 100);
}

/**
 * Get weekly summary
 */
export function useWeeklySummary(): {
    totalReplies: number;
    totalResponses: number;
    responseRate: number;
    avgRepliesPerDay: number;
} {
    const history = useStatsHistory(7);

    const totalReplies = history.reduce((sum, day) => sum + day.repliesSent, 0);
    const totalResponses = history.reduce((sum, day) => sum + day.repliesGotResponse, 0);
    const responseRate = totalReplies > 0
        ? Math.round((totalResponses / totalReplies) * 100)
        : 0;
    const avgRepliesPerDay = history.length > 0
        ? Math.round(totalReplies / history.length)
        : 0;

    return {
        totalReplies,
        totalResponses,
        responseRate,
        avgRepliesPerDay
    };
}
