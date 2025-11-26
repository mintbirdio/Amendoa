import React, { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, MessageCircle, Heart, UserPlus, Users, Search, Zap, RefreshCw, Trash2 } from 'lucide-react';
import { db, type TweetCache, type ScoreBadge, inferTier } from '../db';
import { getBadgeIcon, getTimingLabel, getPositionHint } from '../services/scoreEngine';
import { badgeInjector } from '../services/badgeInjector';
import { addTarget } from '../services/targetManager';

// =============================================================================
// TYPES
// =============================================================================

type QueueTab = 'targets' | 'discovery';

// =============================================================================
// HOOKS
// =============================================================================

function useTargetOpportunities(limit: number = 10): TweetCache[] {
    return useLiveQuery(
        async () => {
            const now = Date.now();
            // 2 hours for targets - they're higher priority so slightly longer window
            const twoHoursAgo = now - 2 * 60 * 60 * 1000;

            // Get tweets from targets in last 2 hours, sorted by score
            const tweets = await db.tweetCache
                .where('opportunityScore')
                .above(20) // Only show "meh" and above
                .and(t => t.postedAt > twoHoursAgo && !t.didReply && t.isFromTarget === true)
                .toArray();

            // Apply time decay and sort
            const withDecay = tweets.map(t => {
                const ageMinutes = (now - t.postedAt) / 1000 / 60;
                let timeFactor = 1.0;
                if (ageMinutes > 60) timeFactor = 0.6;
                else if (ageMinutes > 30) timeFactor = 0.8;
                else if (ageMinutes > 15) timeFactor = 0.9;

                return {
                    ...t,
                    effectiveScore: Math.round(t.opportunityScore * timeFactor)
                };
            });

            return withDecay
                .filter(t => t.effectiveScore >= 15)
                .sort((a, b) => b.effectiveScore - a.effectiveScore)
                .slice(0, limit);
        },
        [limit],
        []
    );
}

function useDiscoveryOpportunities(limit: number = 10): TweetCache[] {
    return useLiveQuery(
        async () => {
            const now = Date.now();
            // Shortened from 24h to 4h - stale tweets aren't valuable
            const fourHoursAgo = now - 4 * 60 * 60 * 1000;

            // Get all recent tweets, then filter to non-targets with good scores
            // We filter in JS because Dexie boolean indexing can be tricky
            const allRecent = await db.tweetCache
                .where('postedAt')
                .above(fourHoursAgo)
                .toArray();

            const discoveryTweets = allRecent
                .filter(t =>
                    t.isFromTarget === false &&
                    !t.didReply &&
                    t.opportunityScore >= 20
                )
                // Re-calculate effective score based on current age for sorting
                .map(t => {
                    const ageMinutes = (now - t.postedAt) / 1000 / 60;
                    // Apply time decay: score drops as tweet ages
                    let timeFactor = 1.0;
                    if (ageMinutes > 120) timeFactor = 0.5;
                    else if (ageMinutes > 60) timeFactor = 0.7;
                    else if (ageMinutes > 30) timeFactor = 0.85;

                    return {
                        ...t,
                        effectiveScore: Math.round(t.opportunityScore * timeFactor)
                    };
                })
                .filter(t => t.effectiveScore >= 15) // Filter out decayed low scores
                .sort((a, b) => b.effectiveScore - a.effectiveScore);

            return discoveryTweets.slice(0, limit);
        },
        [limit],
        []
    );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface OpportunityCardProps {
    tweet: TweetCache;
    showAddButton?: boolean;
    onAddToTargets?: (tweet: TweetCache) => void;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ tweet, showAddButton, onAddToTargets }) => {
    const ageMinutes = (Date.now() - tweet.postedAt) / 1000 / 60;
    const timingLabel = getTimingLabel(ageMinutes);
    const positionHint = getPositionHint(tweet.replies);

    const handleJump = () => {
        badgeInjector.scrollToTweet(tweet.tweetId, tweet.authorHandle);
    };

    // Format follower count for display
    const formatFollowers = (count: number): string => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    return (
        <div className="p-2.5 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5">
            {/* Header: Score + Handle + Time */}
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <ScoreBadge badge={tweet.scoreBadge} score={tweet.opportunityScore} />
                    <span className="text-white/90 text-sm font-medium">@{tweet.authorHandle}</span>
                    {tweet.authorIsPremium && (
                        <span className="text-blue-400 text-[10px]">✓</span>
                    )}
                </div>
                <span className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock size={10} />
                    {timingLabel}
                </span>
            </div>

            {/* Content Preview */}
            <p className="text-gray-400 text-xs line-clamp-2 mb-2 leading-relaxed">
                {tweet.content.slice(0, 120)}{tweet.content.length > 120 ? '...' : ''}
            </p>

            {/* Stats + Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-gray-600">
                    {showAddButton && tweet.authorFollowerCount > 0 && (
                        <span className="flex items-center gap-1">
                            <Users size={10} />
                            {formatFollowers(tweet.authorFollowerCount)}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <MessageCircle size={10} />
                        {tweet.replies}
                    </span>
                    <span className="flex items-center gap-1">
                        <Heart size={10} />
                        {tweet.likes}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        positionHint === 'FIRST' ? 'bg-green-500/20 text-green-400' :
                        positionHint === 'EARLY' ? 'bg-blue-500/20 text-blue-400' :
                        positionHint === 'GOOD' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-red-500/20 text-red-400'
                    }`}>
                        {positionHint}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {showAddButton && onAddToTargets && (
                        <button
                            onClick={() => onAddToTargets(tweet)}
                            className="px-2 py-1 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded transition-colors flex items-center gap-1"
                            title="Add to targets"
                        >
                            <UserPlus size={10} />
                            Track
                        </button>
                    )}
                    <button
                        onClick={handleJump}
                        className="px-2 py-1 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors"
                        title="Jump to tweet (opens new tab if not on page)"
                    >
                        Jump
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ScoreBadgeProps {
    badge: ScoreBadge;
    score: number;
}

const ScoreBadge: React.FC<ScoreBadgeProps> = ({ badge, score }) => {
    const icon = getBadgeIcon(badge);

    const colors = {
        hot: 'bg-red-500/20 border-red-500/40 text-red-400',
        high: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
        good: 'bg-green-500/20 border-green-500/40 text-green-400',
        meh: 'bg-gray-500/20 border-gray-500/40 text-gray-400',
        skip: 'bg-gray-700/20 border-gray-700/40 text-gray-500'
    };

    return (
        <span className={`
            inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold
            border ${colors[badge]}
        `}>
            <span>{icon}</span>
            <span>{score}</span>
        </span>
    );
};

// =============================================================================
// TAB BUTTON COMPONENT
// =============================================================================

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    count: number;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label, count }) => (
    <button
        onClick={onClick}
        className={`
            flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium
            transition-colors rounded-lg
            ${active
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }
        `}
    >
        {icon}
        <span>{label}</span>
        {count > 0 && (
            <span className={`
                ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${active ? 'bg-white/20' : 'bg-white/10'}
            `}>
                {count}
            </span>
        )}
    </button>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ReplyQueue: React.FC = () => {
    const [activeTab, setActiveTab] = useState<QueueTab>('targets');
    const [isClearing, setIsClearing] = useState(false);

    const targetOpportunities = useTargetOpportunities(10);
    const discoveryOpportunities = useDiscoveryOpportunities(10);

    // Clear old/stale tweets from cache
    const handleClearStale = useCallback(async () => {
        setIsClearing(true);
        try {
            const now = Date.now();
            // Remove tweets older than 4 hours that we haven't replied to
            const fourHoursAgo = now - 4 * 60 * 60 * 1000;

            const staleCount = await db.tweetCache
                .where('postedAt')
                .below(fourHoursAgo)
                .and(t => !t.didReply)
                .delete();

            console.log(`[Amendoa v2] Cleared ${staleCount} stale tweets from cache`);
        } catch (err) {
            console.error('[Amendoa v2] Failed to clear stale tweets:', err);
        }
        setIsClearing(false);
    }, []);

    const handleAddToTargets = async (tweet: TweetCache) => {
        try {
            const tier = inferTier(tweet.authorFollowerCount);
            await addTarget({
                handle: tweet.authorHandle,
                displayName: tweet.authorHandle, // We don't have display name in cache
                followerCount: tweet.authorFollowerCount,
                followingCount: 0,
                isPremium: tweet.authorIsPremium,
                tier
            });

            // Update the tweet in cache to mark as from target
            await db.tweetCache.update(tweet.tweetId, { isFromTarget: true });

            console.log(`[Amendoa v2] Added @${tweet.authorHandle} to targets as ${tier}`);
        } catch (err) {
            console.error('[Amendoa v2] Failed to add target:', err);
        }
    };

    const currentOpportunities = activeTab === 'targets' ? targetOpportunities : discoveryOpportunities;
    const emptyMessage = activeTab === 'targets'
        ? { icon: '🎯', title: 'No target tweets right now', subtitle: 'Add targets and scroll your timeline' }
        : { icon: '🔍', title: 'No discoveries yet', subtitle: 'Scroll your timeline to find opportunities' };

    return (
        <div className="p-3">
            {/* Tab Switcher with Clear Button */}
            <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex gap-1 p-1 bg-white/5 rounded-lg">
                    <TabButton
                        active={activeTab === 'targets'}
                        onClick={() => setActiveTab('targets')}
                        icon={<Zap size={12} />}
                        label="Targets"
                        count={targetOpportunities.length}
                    />
                    <TabButton
                        active={activeTab === 'discovery'}
                        onClick={() => setActiveTab('discovery')}
                        icon={<Search size={12} />}
                        label="Discovery"
                        count={discoveryOpportunities.length}
                    />
                </div>
                <button
                    onClick={handleClearStale}
                    disabled={isClearing}
                    className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                    title="Clear stale tweets (>4h old)"
                >
                    {isClearing ? (
                        <RefreshCw size={14} className="animate-spin" />
                    ) : (
                        <Trash2 size={14} />
                    )}
                </button>
            </div>

            {/* Opportunity List */}
            {currentOpportunities.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-2xl mb-2">{emptyMessage.icon}</div>
                    <p className="text-gray-500 text-xs">{emptyMessage.title}</p>
                    <p className="text-gray-600 text-[10px] mt-1">{emptyMessage.subtitle}</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {currentOpportunities.map(tweet => (
                        <OpportunityCard
                            key={tweet.tweetId}
                            tweet={tweet}
                            showAddButton={activeTab === 'discovery'}
                            onAddToTargets={handleAddToTargets}
                        />
                    ))}
                </div>
            )}

            {/* Footer hint */}
            {currentOpportunities.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-gray-600 text-center">
                        {activeTab === 'targets'
                            ? 'Scores update as tweets age. Fresh tweets = higher scores.'
                            : 'High-value accounts you don\'t track. Quality engagement > perfect timing.'
                        }
                    </p>
                </div>
            )}
        </div>
    );
};
