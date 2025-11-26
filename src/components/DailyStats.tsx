import React from 'react';
import { useGamificationStatus, useDailyRequirements } from '../hooks/useGamification';
import { DAILY_REQUIREMENTS } from '../services/gamification';

/**
 * Progress bar component for daily requirements
 */
const ProgressBar: React.FC<{
    current: number;
    max: number;
    label: string;
    icon: string;
}> = ({ current, max, label, icon }) => {
    const progress = Math.min(100, (current / max) * 100);
    const isComplete = current >= max;

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs w-4">{icon}</span>
            <span className="text-xs text-gray-400 w-16">{label}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${
                        isComplete ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            <span className={`text-xs w-12 text-right ${isComplete ? 'text-green-400' : 'text-gray-400'}`}>
                {current}/{max} {isComplete && '✓'}
            </span>
        </div>
    );
};

/**
 * XP Progress bar for tier progression
 */
const XPProgressBar: React.FC<{
    xpIntoRank: number;
    xpForNextRank: number;
    progressPercent: number;
}> = ({ xpIntoRank, xpForNextRank, progressPercent }) => {
    return (
        <div className="mt-1">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
            </div>
            <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-gray-500">
                    {Math.floor(xpForNextRank - xpIntoRank).toLocaleString()} XP to next rank
                </span>
            </div>
        </div>
    );
};

/**
 * Gamification Daily Stats Panel
 * Shows tier, XP progress, streak, and daily requirements
 */
export const DailyStats: React.FC = () => {
    const status = useGamificationStatus();
    const requirements = useDailyRequirements();

    const { rankInfo, currentStreak, multiplier, todayXP, streakSafe } = status;

    // Determine streak status display
    const getStreakDisplay = () => {
        if (currentStreak === 0) {
            return {
                icon: '⚡',
                text: 'Start your streak!',
                subtext: 'Hit daily goals to begin',
                color: 'text-gray-400'
            };
        }

        if (streakSafe) {
            return {
                icon: '🔥',
                text: `${currentStreak} day streak`,
                subtext: `${multiplier}x multiplier`,
                color: 'text-orange-400'
            };
        }

        return {
            icon: '⚠️',
            text: `${currentStreak} day streak`,
            subtext: 'At risk! Complete goals',
            color: 'text-yellow-400'
        };
    };

    const streakDisplay = getStreakDisplay();

    return (
        <div className="px-3 py-3 bg-black/20 border-t border-white/5">
            {/* Tier and XP Section */}
            <div className="mb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{rankInfo.emoji}</span>
                        <div>
                            <div className="text-sm font-medium text-white">
                                {rankInfo.tier} {rankInfo.rank}
                            </div>
                            <div className="text-[10px] text-gray-500">
                                {status.totalXP.toLocaleString()} XP total
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-medium text-green-400">
                            +{todayXP} XP
                        </div>
                        <div className="text-[10px] text-gray-500">today</div>
                    </div>
                </div>

                <XPProgressBar
                    xpIntoRank={rankInfo.xpIntoRank}
                    xpForNextRank={rankInfo.xpForNextRank}
                    progressPercent={rankInfo.progressPercent}
                />
            </div>

            {/* Streak Section */}
            <div className={`flex items-center gap-2 mb-3 py-1.5 px-2 rounded-md ${
                streakSafe ? 'bg-orange-500/10' : currentStreak > 0 ? 'bg-yellow-500/10' : 'bg-white/5'
            }`}>
                <span className="text-base">{streakDisplay.icon}</span>
                <div className="flex-1">
                    <div className={`text-xs font-medium ${streakDisplay.color}`}>
                        {streakDisplay.text}
                    </div>
                    <div className="text-[10px] text-gray-500">
                        {streakDisplay.subtext}
                    </div>
                </div>
                {multiplier > 1 && (
                    <div className="text-xs font-bold text-orange-400">
                        {multiplier}x
                    </div>
                )}
            </div>

            {/* Daily Requirements Section */}
            <div className="space-y-2">
                <div className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">
                    Daily Goals
                </div>

                <ProgressBar
                    current={requirements.repliesSent}
                    max={DAILY_REQUIREMENTS.minReplies}
                    label="Replies"
                    icon="💬"
                />

                <ProgressBar
                    current={requirements.postsSent}
                    max={DAILY_REQUIREMENTS.minPosts}
                    label="Posts"
                    icon="📝"
                />
            </div>

            {/* Streak Safe Indicator */}
            {streakSafe && (
                <div className="mt-2 text-center">
                    <span className="text-[10px] text-green-400 font-medium">
                        ✓ Streak secured for today!
                    </span>
                </div>
            )}
        </div>
    );
};
