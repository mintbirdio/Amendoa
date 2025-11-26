import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Zap, MessageSquare, Target, Settings } from 'lucide-react';
import { TargetList } from './TargetList';
import { DailyStats } from './DailyStats';
import { ReplyQueue } from './ReplyQueue';
import { ConversationObligations } from './ConversationObligations';

// =============================================================================
// TYPES
// =============================================================================

type Tab = 'queue' | 'convos' | 'targets';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Sidebar: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('queue');

    // Collapsed state - just a thin strip with expand button
    if (isCollapsed) {
        return (
            <div className="fixed right-0 top-0 h-screen w-[48px] bg-gray-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[9999] flex flex-col items-center pt-4 font-sans transition-all duration-300">
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="w-8 h-8 bg-gray-900 border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-amber-400 hover:border-amber-400 transition-all mb-4"
                    title="Expand Amendoa"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
            </div>
        );
    }

    return (
        <div className="fixed right-0 top-0 h-screen w-[300px] bg-gray-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[9999] flex flex-col font-sans transition-all duration-300">
            {/* Header */}
            <div className="px-3 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white transition-all"
                        title="Collapse"
                    >
                        <ChevronRight size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                        <h1 className="text-amber-50 font-bold tracking-wider text-sm">
                            AMENDOA
                            <span className="text-[9px] opacity-40 font-normal ml-1.5">v2</span>
                        </h1>
                    </div>
                </div>

                <button
                    className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-all"
                    title="Settings"
                >
                    <Settings size={14} />
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="px-2 py-2 border-b border-white/5">
                <div className="flex bg-gray-900/50 rounded-lg p-1 gap-1">
                    <TabButton
                        icon={Zap}
                        label="Queue"
                        isActive={activeTab === 'queue'}
                        onClick={() => setActiveTab('queue')}
                    />
                    <TabButton
                        icon={MessageSquare}
                        label="Convos"
                        isActive={activeTab === 'convos'}
                        onClick={() => setActiveTab('convos')}
                    />
                    <TabButton
                        icon={Target}
                        label="Targets"
                        isActive={activeTab === 'targets'}
                        onClick={() => setActiveTab('targets')}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'queue' && <ReplyQueue />}
                {activeTab === 'convos' && <ConversationObligations />}
                {activeTab === 'targets' && <TargetList />}
            </div>

            {/* Footer - Daily Stats */}
            <DailyStats />

            {/* Status Bar */}
            <div className="px-3 py-2 border-t border-white/5 text-[10px] text-gray-600 flex justify-between items-center bg-black/30">
                <span>v2.0.0</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-green-500 font-medium">Active</span>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface TabButtonProps {
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
    badge?: number;
}

const TabButton: React.FC<TabButtonProps> = ({
    icon: Icon,
    label,
    isActive,
    onClick,
    badge
}) => {
    return (
        <button
            onClick={onClick}
            className={`
                flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all relative
                ${isActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }
            `}
        >
            <Icon size={14} />
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
};
