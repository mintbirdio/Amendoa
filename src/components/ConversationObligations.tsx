import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Clock, AlertCircle } from 'lucide-react';
import { db, type Conversation, type Tier } from '../db';

// =============================================================================
// TYPES
// =============================================================================

type UrgencyLevel = 'urgent' | 'soon' | 'later';

interface GroupedObligations {
    urgent: Conversation[];  // < 30 min
    soon: Conversation[];    // 30 min - 2 hrs
    later: Conversation[];   // 2+ hrs
}

// =============================================================================
// HOOKS
// =============================================================================

function useObligations(): GroupedObligations {
    return useLiveQuery(
        async () => {
            const obligations = await db.conversations
                .where('isObligation')
                .equals(1) // Dexie uses 1 for true
                .and(c => !c.isDismissed)
                .toArray();

            // Fallback: also try boolean true
            const obligationsAlt = await db.conversations
                .filter(c => c.isObligation === true && !c.isDismissed)
                .toArray();

            const all = obligations.length > 0 ? obligations : obligationsAlt;

            const now = Date.now();
            const thirtyMinutes = 30 * 60 * 1000;
            const twoHours = 2 * 60 * 60 * 1000;

            const grouped: GroupedObligations = {
                urgent: [],
                soon: [],
                later: []
            };

            for (const conv of all) {
                const age = now - conv.lastMessageAt;
                if (age < thirtyMinutes) {
                    grouped.urgent.push(conv);
                } else if (age < twoHours) {
                    grouped.soon.push(conv);
                } else {
                    grouped.later.push(conv);
                }
            }

            // Sort each group by recency
            grouped.urgent.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
            grouped.soon.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
            grouped.later.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

            return grouped;
        },
        [],
        { urgent: [], soon: [], later: [] }
    );
}

function useObligationCount(): number {
    return useLiveQuery(
        async () => {
            return db.conversations
                .filter(c => c.isObligation === true && !c.isDismissed)
                .count();
        },
        [],
        0
    );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function getTierColor(tier: Tier | null): string {
    switch (tier) {
        case 'titan': return 'text-amber-400';
        case 'star': return 'text-purple-400';
        case 'rising': return 'text-blue-400';
        case 'emerging': return 'text-green-400';
        case 'peer': return 'text-gray-400';
        default: return 'text-gray-500';
    }
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface ObligationCardProps {
    conversation: Conversation;
    urgency: UrgencyLevel;
    onDismiss: (id: string) => void;
}

const ObligationCard: React.FC<ObligationCardProps> = ({
    conversation,
    urgency,
    onDismiss
}) => {
    const handleContinue = () => {
        window.open(conversation.threadUrl, '_blank');
    };

    const urgencyIcon = {
        urgent: '⚠️',
        soon: '⏰',
        later: '💤'
    };

    return (
        <div className="p-2.5 bg-white/[0.02] hover:bg-white/5 rounded-lg transition-colors border border-white/5">
            {/* Header */}
            <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <span>{urgencyIcon[urgency]}</span>
                    <span className={`text-sm font-medium ${getTierColor(conversation.otherPartyTier)}`}>
                        @{conversation.otherPartyHandle}
                    </span>
                </div>
                <span className="text-gray-600 text-[10px] flex items-center gap-1">
                    <Clock size={10} />
                    {formatTimeAgo(conversation.lastMessageAt)}
                </span>
            </div>

            {/* Message Preview */}
            <p className="text-gray-400 text-xs line-clamp-2 mb-2 leading-relaxed pl-6">
                "{conversation.lastMessagePreview}"
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pl-6">
                <button
                    onClick={() => onDismiss(conversation.id)}
                    className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                    Dismiss
                </button>
                <button
                    onClick={handleContinue}
                    className="px-2.5 py-1 text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors flex items-center gap-1"
                >
                    Continue
                    <ExternalLink size={10} />
                </button>
            </div>
        </div>
    );
};

interface UrgencySectionProps {
    title: string;
    icon: string;
    color: string;
    conversations: Conversation[];
    urgency: UrgencyLevel;
    onDismiss: (id: string) => void;
}

const UrgencySection: React.FC<UrgencySectionProps> = ({
    title,
    icon,
    color,
    conversations,
    urgency,
    onDismiss
}) => {
    if (conversations.length === 0) return null;

    return (
        <div className="mb-4">
            <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold tracking-wide ${color}`}>
                <span>{icon}</span>
                <span>{title}</span>
                <span className="text-gray-600 font-normal">({conversations.length})</span>
            </div>
            <div className="space-y-2">
                {conversations.map(conv => (
                    <ObligationCard
                        key={conv.id}
                        conversation={conv}
                        urgency={urgency}
                        onDismiss={onDismiss}
                    />
                ))}
            </div>
        </div>
    );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ConversationObligations: React.FC = () => {
    const obligations = useObligations();
    const totalCount = obligations.urgent.length + obligations.soon.length + obligations.later.length;

    const handleDismiss = async (id: string) => {
        await db.conversations.update(id, { isDismissed: true });
    };

    return (
        <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-gray-400 tracking-wide flex items-center gap-2">
                    💬 CONVERSATIONS
                    {totalCount > 0 && (
                        <span className="text-gray-600 font-normal">({totalCount})</span>
                    )}
                </h2>
            </div>

            {/* Info Banner */}
            {totalCount > 0 && obligations.urgent.length > 0 && (
                <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400/80 flex items-start gap-2">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                        Reply-backs trigger 75x algorithmic boost. Don't leave these hanging!
                    </span>
                </div>
            )}

            {/* Empty State */}
            {totalCount === 0 ? (
                <div className="text-center py-8">
                    <div className="text-2xl mb-2">✅</div>
                    <p className="text-gray-500 text-xs">No pending conversations</p>
                    <p className="text-gray-600 text-[10px] mt-1">You're all caught up!</p>
                </div>
            ) : (
                <>
                    <UrgencySection
                        title="URGENT"
                        icon="🔴"
                        color="text-red-400"
                        conversations={obligations.urgent}
                        urgency="urgent"
                        onDismiss={handleDismiss}
                    />
                    <UrgencySection
                        title="SOON"
                        icon="🟡"
                        color="text-amber-400"
                        conversations={obligations.soon}
                        urgency="soon"
                        onDismiss={handleDismiss}
                    />
                    <UrgencySection
                        title="LATER"
                        icon="⚪"
                        color="text-gray-500"
                        conversations={obligations.later}
                        urgency="later"
                        onDismiss={handleDismiss}
                    />
                </>
            )}
        </div>
    );
};

// Export the hook for use in Sidebar badge
export { useObligationCount };
