import React from 'react';
import { Clock, ExternalLink, Sparkles } from 'lucide-react';
import { type OurReply } from '../db';
import { useSentReplies, useSentRepliesCounts } from '../hooks/useSentReplies';

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function buildReplyUrl(replyId: string): string {
    return `https://x.com/i/web/status/${replyId}`;
}

// =============================================================================
// ROW
// =============================================================================

interface SentReplyRowProps {
    reply: OurReply;
}

const SentReplyRow: React.FC<SentReplyRowProps> = ({ reply }) => {
    const isAmendoa = reply.source === 'amendoa';

    return (
        <div className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all duration-200">
            {/* Top Row: Handle + Badge + Time */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-white/90 text-sm font-medium">@{reply.inReplyToHandle}</span>
                    <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                            isAmendoa
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                : 'bg-white/5 border-white/10 text-gray-500'
                        }`}
                    >
                        {isAmendoa && <Sparkles size={9} />}
                        {isAmendoa ? 'via Amendoa' : 'native'}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <Clock size={10} />
                    <span>{formatTimeAgo(reply.repliedAt)}</span>
                </div>
            </div>

            {/* Original Tweet (1 line, gray) */}
            {reply.originalTweetContent && (
                <p className="text-gray-600 text-[11px] mb-1 line-clamp-1 leading-relaxed">
                    {reply.originalTweetContent}
                </p>
            )}

            {/* Our Reply (2 lines, white) */}
            <p className="text-gray-300 text-xs mb-2 line-clamp-2 leading-relaxed">
                {reply.content || <span className="italic text-gray-600">(no text captured)</span>}
            </p>

            {/* Footer: Link out */}
            <div className="flex items-center justify-end">
                <a
                    href={buildReplyUrl(reply.replyId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-6 h-6 text-[10px] font-medium text-gray-500 hover:text-amber-300 bg-white/[0.02] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 rounded-md transition-all"
                    title="Open on X"
                >
                    <ExternalLink size={10} />
                </a>
            </div>
        </div>
    );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const SentReplies: React.FC = () => {
    const replies = useSentReplies(50);
    const counts = useSentRepliesCounts();

    return (
        <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h2 className="text-white/90 text-sm font-semibold">Sent Replies</h2>
                    <p className="text-gray-600 text-[10px]">
                        {counts.total} total • {counts.amendoa} via Amendoa • {counts.native} native
                    </p>
                </div>
            </div>

            {/* List */}
            {replies.length === 0 ? (
                <div className="text-center py-10">
                    <div className="text-3xl mb-3">📬</div>
                    <p className="text-gray-400 text-sm font-medium">No replies logged yet</p>
                    <p className="text-gray-600 text-xs mt-1">
                        Hit Reply on a queue item to get started.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {replies.map(reply => (
                        <SentReplyRow key={reply.replyId} reply={reply} />
                    ))}
                </div>
            )}
        </div>
    );
};
