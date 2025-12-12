import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DailyStats } from './DailyStats';
import { ReplyQueue } from './ReplyQueue';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Sidebar: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Collapsed state - floating branded pill button
    if (isCollapsed) {
        return (
            <button
                onClick={() => setIsCollapsed(false)}
                className="fixed right-4 top-4 z-[9999] flex items-center gap-2 px-3 py-2 bg-gray-950/95 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all duration-300 font-sans group"
                title="Open Amendoa"
            >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] group-hover:shadow-[0_0_12px_rgba(245,158,11,0.7)] transition-all"></div>
                <span className="text-amber-50 font-bold tracking-wider text-xs">AMENDOA</span>
            </button>
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
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-green-500 text-[10px] font-medium">Active</span>
                </div>
            </div>

            {/* Content Area - Discovery Queue */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <ReplyQueue />
            </div>

            {/* Footer - Daily Stats */}
            <DailyStats />
        </div>
    );
};
