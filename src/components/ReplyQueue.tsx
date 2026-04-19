import React, { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, MessageCircle, Heart, Users, RefreshCw, Send, ExternalLink } from 'lucide-react';
import { db, type TweetCache, type ScoreBadge } from '../db';
import { getBadgeIcon, getTimingLabel, getPositionHint } from '../services/scoreEngine';
import { badgeInjector } from '../services/badgeInjector';
import { openReplyComposer } from '../services/replyFlow';
import { setPending } from '../services/replyLogger';

// Module-scope in-flight set to guard against fast double-clicks on the
// Reply button. Entries are removed when the composer open attempt settles.
const inFlightReplyOpens = new Set<string>();

// =============================================================================
// HOOKS
// =============================================================================

function useOpportunities(limit: number = 15): TweetCache[] {
    return useLiveQuery(
        async () => {
            const now = Date.now();
            // 1 hour window - fresh tweets for algorithm boost
            const oneHourAgo = now - 60 * 60 * 1000;

            const allRecent = await db.tweetCache
                .where('postedAt')
                .above(oneHourAgo)
                .toArray();

            const opportunities = allRecent
                .filter(t =>
                    !t.didReply &&
                    t.opportunityScore >= 20 // "Meh" and above
                )
                .map(t => {
                    const ageMinutes = (now - t.postedAt) / 1000 / 60;
                    // Time decay - fresher is better
                    let timeFactor = 1.0;
                    if (ageMinutes > 45) timeFactor = 0.5;
                    else if (ageMinutes > 30) timeFactor = 0.65;
                    else if (ageMinutes > 15) timeFactor = 0.8;
                    else if (ageMinutes > 5) timeFactor = 0.9;

                    return {
                        ...t,
                        effectiveScore: Math.round(t.opportunityScore * timeFactor)
                    };
                })
                .filter(t => t.effectiveScore >= 15)
                .sort((a, b) => b.effectiveScore - a.effectiveScore);

            return opportunities.slice(0, limit);
        },
        [limit],
        []
    );
}

function useCacheStats() {
    return useLiveQuery(
        async () => {
            const now = Date.now();
            const oneHourAgo = now - 60 * 60 * 1000;

            const totalInCache = await db.tweetCache.count();
            const recentTweets = await db.tweetCache
                .where('postedAt')
                .above(oneHourAgo)
                .count();

            return { totalInCache, recentTweets };
        },
        [],
        { totalInCache: 0, recentTweets: 0 }
    );
}

// =============================================================================
// OPPORTUNITY CARD
// =============================================================================

interface OpportunityCardProps {
    tweet: TweetCache;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ tweet }) => {
    const ageMinutes = (Date.now() - tweet.postedAt) / 1000 / 60;
    const timingLabel = getTimingLabel(ageMinutes);
    const positionHint = getPositionHint(tweet.replies);

    const handleReply = async () => {
        // Double-click guard: ignore if an open for this tweet is already in flight.
        if (inFlightReplyOpens.has(tweet.tweetId)) return;
        inFlightReplyOpens.add(tweet.tweetId);
        try {
            setPending(tweet.tweetId, tweet.authorHandle, '');
            await openReplyComposer(tweet.tweetId, tweet.authorHandle, '');
        } catch (err) {
            console.warn('[Amendoa] openReplyComposer failed:', err);
        } finally {
            inFlightReplyOpens.delete(tweet.tweetId);
        }
    };

    const handleJump = () => {
        badgeInjector.scrollToTweet(tweet.tweetId, tweet.authorHandle);
    };

    const formatFollowers = (count: number): string => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    // Position hint styling
    const positionStyles = {
        FIRST: 'bg-green-500/20 text-green-400 border-green-500/30',
        EARLY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        GOOD: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        CROWDED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        MOB: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return (
        <div className="group p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all duration-200">
            {/* Top Row: Score + Author + Time */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <ScoreBadge badge={tweet.scoreBadge} score={tweet.opportunityScore} />
                    <div className="flex items-center gap-1.5">
                        <span className="text-white/90 text-sm font-medium">@{tweet.authorHandle}</span>
                        {tweet.authorIsPremium && (
                            <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 22 22" fill="currentColor">
                                <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>
                            </svg>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <Clock size={10} />
                    <span>{timingLabel}</span>
                </div>
            </div>

            {/* Content Preview */}
            <p className="text-gray-400 text-xs leading-relaxed mb-3 line-clamp-2">
                {tweet.content.slice(0, 140)}{tweet.content.length > 140 ? '...' : ''}
            </p>

            {/* Bottom Row: Stats + Action */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-gray-600">
                    <span className="flex items-center gap-1">
                        <Users size={10} />
                        {formatFollowers(tweet.authorFollowerCount)}
                    </span>
                    <span className="flex items-center gap-1">
                        <MessageCircle size={10} />
                        {tweet.replies}
                    </span>
                    <span className="flex items-center gap-1">
                        <Heart size={10} />
                        {tweet.likes}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${positionStyles[positionHint as keyof typeof positionStyles] || positionStyles.GOOD}`}>
                        {positionHint}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handleJump}
                        className="flex items-center justify-center w-6 h-6 text-[10px] font-medium text-gray-500 hover:text-amber-300 bg-white/[0.02] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 rounded-md transition-all"
                        title="Jump to tweet"
                    >
                        <ExternalLink size={10} />
                    </button>
                    <button
                        onClick={handleReply}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/30 rounded-md transition-all"
                    >
                        <Send size={10} />
                        Reply
                    </button>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// SCORE BADGE
// =============================================================================

interface ScoreBadgeProps {
    badge: ScoreBadge;
    score: number;
}

const ScoreBadge: React.FC<ScoreBadgeProps> = ({ badge, score }) => {
    const icon = getBadgeIcon(badge);

    const styles = {
        hot: 'bg-red-500/20 border-red-500/40 text-red-400',
        high: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
        good: 'bg-green-500/20 border-green-500/40 text-green-400',
        meh: 'bg-gray-500/20 border-gray-500/40 text-gray-400',
        skip: 'bg-gray-700/20 border-gray-700/40 text-gray-500'
    };

    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold border ${styles[badge]}`}>
            <span>{icon}</span>
            <span>{score}</span>
        </span>
    );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ReplyQueue: React.FC = () => {
    const [isClearing, setIsClearing] = useState(false);
    const opportunities = useOpportunities(15);
    const cacheStats = useCacheStats();

    const handleClearStale = useCallback(async () => {
        setIsClearing(true);
        try {
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            const staleCount = await db.tweetCache
                .where('postedAt')
                .below(oneHourAgo)
                .and(t => !t.didReply)
                .delete();
            console.log(`[Amendoa] Cleared ${staleCount} stale tweets`);
        } catch (err) {
            console.error('[Amendoa] Failed to clear stale tweets:', err);
        }
        setIsClearing(false);
    }, []);

    return (
        <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h2 className="text-white/90 text-sm font-semibold">Reply Opportunities</h2>
                    <p className="text-gray-600 text-[10px]">Fresh tweets worth replying to</p>
                </div>
                <button
                    onClick={handleClearStale}
                    disabled={isClearing}
                    className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-md transition-colors disabled:opacity-50"
                    title="Clear stale tweets"
                >
                    <RefreshCw size={12} className={isClearing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Opportunity List */}
            {opportunities.length === 0 ? (
                <div className="text-center py-10">
                    <div className="text-3xl mb-3">🔍</div>
                    <p className="text-gray-400 text-sm font-medium">No opportunities yet</p>
                    <p className="text-gray-600 text-xs mt-1">Scroll your timeline to discover tweets</p>

                    {/* Cache Stats */}
                    <div className="mt-6 pt-4 border-t border-white/5">
                        <p className="text-[10px] text-gray-700">
                            {cacheStats.recentTweets} tweets in last hour • {cacheStats.totalInCache} total cached
                        </p>
                        {cacheStats.recentTweets === 0 && (
                            <p className="text-[10px] text-amber-600/60 mt-2">
                                Browse For You, Following, or Communities to capture tweets
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        {opportunities.map(tweet => (
                            <OpportunityCard key={tweet.tweetId} tweet={tweet} />
                        ))}
                    </div>

                    {/* Footer Hint */}
                    <div className="mt-4 pt-3 border-t border-white/5">
                        <p className="text-[10px] text-gray-600 text-center">
                            ⚡ Under 5 min = prime time • Early replies get 3-5x visibility
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};
