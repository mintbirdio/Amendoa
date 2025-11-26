import React, { useState } from 'react';
import {
    Crown,
    Star,
    Rocket,
    Sprout,
    Users,
    Plus,
    X,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    BadgeCheck
} from 'lucide-react';
import { useTargetManager } from '../hooks/useTargets';
import { type Tier, type TargetAccount, inferTier } from '../db';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

interface TierConfig {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
    titan: {
        icon: Crown,
        label: 'TITANS',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20'
    },
    star: {
        icon: Star,
        label: 'STARS',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20'
    },
    rising: {
        icon: Rocket,
        label: 'RISING',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20'
    },
    emerging: {
        icon: Sprout,
        label: 'EMERGING',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/20'
    },
    peer: {
        icon: Users,
        label: 'PEERS',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/20'
    }
};

const TIER_ORDER: Tier[] = ['titan', 'star', 'rising', 'emerging', 'peer'];

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function formatFollowerCount(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
}

interface AddTargetModalProps {
    onClose: () => void;
    onAdd: (handle: string, tier?: Tier) => Promise<void>;
    defaultTier?: Tier;
}

const AddTargetModal: React.FC<AddTargetModalProps> = ({ onClose, onAdd, defaultTier }) => {
    const [handle, setHandle] = useState('');
    const [tier, setTier] = useState<Tier>(defaultTier || 'peer');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!handle.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            await onAdd(handle.trim(), tier);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add target');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]">
            <div className="bg-gray-900 border border-white/10 rounded-lg p-4 w-[280px] shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white">Add Target</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Handle</label>
                        <input
                            type="text"
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            placeholder="@username"
                            className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                            autoFocus
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs text-gray-500 mb-1">Tier</label>
                        <select
                            value={tier}
                            onChange={(e) => setTier(e.target.value as Tier)}
                            className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                        >
                            {TIER_ORDER.map(t => (
                                <option key={t} value={t}>
                                    {TIER_CONFIG[t].label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <div className="mb-3 text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle size={12} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !handle.trim()}
                        className="w-full bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded py-2 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Adding...' : 'Add Target'}
                    </button>
                </form>
            </div>
        </div>
    );
};

interface TargetRowProps {
    target: TargetAccount;
    onRemove: (handle: string) => void;
}

const TargetRow: React.FC<TargetRowProps> = ({ target, onRemove }) => {
    const [showConfirm, setShowConfirm] = useState(false);

    return (
        <div className="flex items-center justify-between py-1.5 px-2 hover:bg-white/5 rounded transition-colors group">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-white/90 text-sm truncate">@{target.handle}</span>
                {target.isPremium && (
                    <BadgeCheck size={12} className="text-blue-400 flex-shrink-0" />
                )}
                <span className="text-gray-600 text-xs flex-shrink-0">
                    {formatFollowerCount(target.followerCount)}
                </span>
            </div>

            {showConfirm ? (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onRemove(target.handle)}
                        className="text-xs text-red-400 hover:text-red-300 px-1"
                    >
                        Yes
                    </button>
                    <button
                        onClick={() => setShowConfirm(false)}
                        className="text-xs text-gray-500 hover:text-gray-300 px-1"
                    >
                        No
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowConfirm(true)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
};

interface TierSectionProps {
    tier: Tier;
    targets: TargetAccount[];
    onRemove: (handle: string) => void;
    onAddClick: (tier: Tier) => void;
}

const TierSection: React.FC<TierSectionProps> = ({
    tier,
    targets,
    onRemove,
    onAddClick
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const config = TIER_CONFIG[tier];
    const Icon = config.icon;

    return (
        <div className="mb-3">
            {/* Tier Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded ${config.bgColor} border ${config.borderColor} hover:border-white/20 transition-colors`}
            >
                <div className="flex items-center gap-2">
                    <Icon size={14} className={config.color} />
                    <span className={`text-xs font-bold tracking-wide ${config.color}`}>
                        {config.label}
                    </span>
                    <span className="text-xs text-gray-500">({targets.length})</span>
                </div>
                {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-500" />
                ) : (
                    <ChevronRight size={14} className="text-gray-500" />
                )}
            </button>

            {/* Targets List */}
            {isExpanded && (
                <div className="mt-1 ml-2 border-l border-white/5 pl-2">
                    {targets.length === 0 ? (
                        <button
                            onClick={() => onAddClick(tier)}
                            className="flex items-center gap-1.5 py-1.5 px-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            <Plus size={12} />
                            Add {config.label.toLowerCase().slice(0, -1)}
                        </button>
                    ) : (
                        <>
                            {targets.map(target => (
                                <TargetRow
                                    key={target.handle}
                                    target={target}
                                    onRemove={onRemove}
                                />
                            ))}
                            <button
                                onClick={() => onAddClick(tier)}
                                className="flex items-center gap-1 py-1 px-2 text-xs text-gray-600 hover:text-amber-400 transition-colors"
                            >
                                <Plus size={10} />
                                Add
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const TargetList: React.FC = () => {
    const { targets, stats, warnings, actions } = useTargetManager();
    const [showAddModal, setShowAddModal] = useState(false);
    const [addModalTier, setAddModalTier] = useState<Tier | undefined>();

    const handleAddClick = (tier?: Tier) => {
        setAddModalTier(tier);
        setShowAddModal(true);
    };

    const handleAdd = async (handle: string, tier?: Tier) => {
        await actions.add({
            handle,
            tier: tier || inferTier(0), // Will be updated when we get profile data
            followerCount: 0,
            followingCount: 0
        });
    };

    const handleRemove = async (handle: string) => {
        await actions.remove(handle);
    };

    return (
        <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-gray-400 tracking-wide flex items-center gap-2">
                    🎯 TARGETS
                    <span className="text-gray-600 font-normal">({stats.total})</span>
                </h2>
                <button
                    onClick={() => handleAddClick()}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded transition-colors"
                >
                    <Plus size={12} />
                    Add
                </button>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
                <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400/80">
                    <div className="flex items-start gap-1.5">
                        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{warnings[0].message}</span>
                    </div>
                </div>
            )}

            {/* Tier Sections */}
            <div className="space-y-1">
                {TIER_ORDER.map(tier => (
                    <TierSection
                        key={tier}
                        tier={tier}
                        targets={targets[tier]}
                        onRemove={handleRemove}
                        onAddClick={handleAddClick}
                    />
                ))}
            </div>

            {/* Score Legend */}
            <div className="mt-4 pt-3 border-t border-white/5">
                <h3 className="text-[10px] font-bold text-gray-500 tracking-wide mb-2">BADGE LEGEND</h3>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white border border-yellow-400">
                            🔥 80+
                        </span>
                        <span className="text-[10px] text-gray-500">Hot — Reply NOW!</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 border border-yellow-300">
                            ⚡ 60-79
                        </span>
                        <span className="text-[10px] text-gray-500">High — Great opportunity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border border-green-400">
                            ✓ 40-59
                        </span>
                        <span className="text-[10px] text-gray-500">Good — Worth replying</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-400 border border-slate-600">
                            ~ 20-39
                        </span>
                        <span className="text-[10px] text-gray-500">Meh — Low priority</span>
                    </div>
                </div>
                <p className="text-[9px] text-gray-600 mt-2 leading-relaxed">
                    Score = Author Value × Timing × Competition. Fresh tweets with few replies score highest.
                </p>
            </div>

            {/* Stats Footer */}
            {stats.total > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5">
                    <div className="text-[10px] text-gray-600 space-y-1">
                        <div className="flex justify-between">
                            <span>With notifications</span>
                            <span>{stats.withNotifications}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Active this week</span>
                            <span>{stats.activeThisWeek}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <AddTargetModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAdd}
                    defaultTier={addModalTier}
                />
            )}
        </div>
    );
};
