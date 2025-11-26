import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useGamificationStatus, useDailyRequirements } from '../hooks/useGamification';
import { DAILY_REQUIREMENTS } from '../services/gamification';
import { generateAndShare } from '../services/statsImageGenerator';

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
            <span className="text-xs text-gray-400 w-14">{label}</span>
            <div className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${
                        isComplete ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            <span className={`text-xs w-10 text-right font-medium ${isComplete ? 'text-green-400' : 'text-gray-400'}`}>
                {current}/{max} {isComplete && '✓'}
            </span>
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
    const [isSharing, setIsSharing] = useState(false);

    const { rankInfo, currentStreak, multiplier, todayXP, streakSafe } = status;

    // Handle share button click
    const handleShare = async () => {
        setIsSharing(true);
        try {
            await generateAndShare({ type: 'weekly' });
        } catch (err) {
            console.error('[Amendoa] Failed to share stats:', err);
        }
        setIsSharing(false);
    };

    // Determine streak status display
    const getStreakDisplay = () => {
        if (currentStreak === 0) {
            return {
                icon: '⚡',
                text: 'Start your streak!',
                subtext: 'Hit daily goals to begin',
                color: 'text-gray-400',
                bg: 'bg-white/5'
            };
        }

        if (streakSafe) {
            return {
                icon: '🔥',
                text: `${currentStreak} day streak`,
                subtext: `${multiplier}x XP multiplier`,
                color: 'text-orange-400',
                bg: 'bg-gradient-to-r from-orange-500/20 to-red-500/20'
            };
        }

        return {
            icon: '⚠️',
            text: `${currentStreak} day streak`,
            subtext: 'At risk! Complete goals',
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10'
        };
    };

    const streakDisplay = getStreakDisplay();

    // Calculate XP to next rank
    const xpToNext = Math.floor(rankInfo.xpForNextRank - rankInfo.xpIntoRank);

    return (
        <div className="mx-2 mb-2 rounded-lg overflow-hidden border border-white/10 bg-gradient-to-b from-gray-900/80 to-gray-950/80">
            {/* Header with Rank and Share */}
            <div className="px-3 py-2.5 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="text-2xl">{rankInfo.emoji}</div>
                        <div>
                            <div className="text-sm font-bold text-white">
                                {rankInfo.tier} {rankInfo.rank}
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {status.totalXP.toLocaleString()} XP total
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <div className="text-base font-bold text-green-400">
                                +{todayXP}
                            </div>
                            <div className="text-[9px] text-gray-500 uppercase">today</div>
                        </div>
                        <button
                            onClick={handleShare}
                            disabled={isSharing}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                            title="Share your stats"
                        >
                            <Share2 size={14} className={isSharing ? 'animate-pulse' : ''} />
                        </button>
                    </div>
                </div>

                {/* XP Progress Bar */}
                <div className="mt-2">
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, rankInfo.progressPercent)}%` }}
                        />
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5">
                        {xpToNext.toLocaleString()} XP to next rank
                    </div>
                </div>
            </div>

            {/* Streak Banner */}
            <div className={`flex items-center gap-2 px-3 py-2 ${streakDisplay.bg}`}>
                <span className="text-lg">{streakDisplay.icon}</span>
                <div className="flex-1">
                    <div className={`text-xs font-semibold ${streakDisplay.color}`}>
                        {streakDisplay.text}
                    </div>
                    <div className="text-[10px] text-gray-500">
                        {streakDisplay.subtext}
                    </div>
                </div>
                {multiplier > 1 && (
                    <div className="px-2 py-0.5 bg-orange-500/20 rounded-full text-xs font-bold text-orange-400">
                        {multiplier}x
                    </div>
                )}
            </div>

            {/* Daily Goals */}
            <div className="px-3 py-2.5 space-y-1.5">
                <div className="text-[9px] text-gray-500 font-semibold tracking-wider uppercase mb-2">
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

                {/* Streak Safe Indicator */}
                {streakSafe && (
                    <div className="mt-2 pt-2 border-t border-white/5 text-center">
                        <span className="text-[10px] text-green-400 font-medium">
                            ✓ Streak secured for today!
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
