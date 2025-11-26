import React from 'react';
import { useTodayStats, useResponseRate } from '../hooks/useDailyStats';

export const DailyStats: React.FC = () => {
    const stats = useTodayStats();
    const responseRate = useResponseRate();

    return (
        <div className="px-3 py-2 bg-black/20 border-t border-white/5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-medium tracking-wide">
                    📊 TODAY
                </span>
            </div>
            <div className="mt-1 text-xs text-gray-400">
                <span className="text-white/80">{stats.repliesSent}</span>
                {' replies'}
                {stats.repliesSent > 0 && (
                    <>
                        {' • '}
                        <span className="text-white/80">{stats.repliesGotResponse}</span>
                        {' responses '}
                        <span className={responseRate >= 30 ? 'text-green-400' : 'text-gray-500'}>
                            ({responseRate}%)
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};
