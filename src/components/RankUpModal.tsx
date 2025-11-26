import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Share2 } from 'lucide-react';
import { type TierRankInfo } from '../services/gamification';

interface RankUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    previousRank: TierRankInfo;
    newRank: TierRankInfo;
    onShare?: () => void;
}

/**
 * Modal that appears when user ranks up
 * Shows celebratory animation with old -> new rank
 */
export const RankUpModal: React.FC<RankUpModalProps> = ({
    isOpen,
    onClose,
    previousRank,
    newRank,
    onShare
}) => {
    const [showConfetti, setShowConfetti] = useState(false);

    // Trigger confetti on open
    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            const timer = setTimeout(() => setShowConfetti(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Determine if it's a tier change or just a rank progression
    const isTierChange = previousRank.tier !== newRank.tier;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-xl">
                    {/* Confetti particles */}
                    {showConfetti && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-2 h-2 rounded-full"
                                    style={{
                                        left: `${Math.random() * 100}%`,
                                        backgroundColor: ['#fbbf24', '#f59e0b', '#d97706', '#a855f7', '#ec4899'][i % 5]
                                    }}
                                    initial={{ y: -20, opacity: 1, scale: 1 }}
                                    animate={{
                                        y: '100vh',
                                        opacity: 0,
                                        rotate: Math.random() * 360
                                    }}
                                    transition={{
                                        duration: 2 + Math.random(),
                                        delay: Math.random() * 0.5,
                                        ease: 'easeOut'
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="glass-panel w-[360px] p-6 rounded-xl border border-white/10 relative overflow-hidden"
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>

                        {/* Header */}
                        <div className="text-center mb-6">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                className="text-5xl mb-3"
                            >
                                {newRank.emoji}
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <div className="text-xs text-amber-500 uppercase tracking-widest mb-1">
                                    {isTierChange ? 'New Tier Unlocked!' : 'Rank Up!'}
                                </div>
                                <h2 className="text-2xl font-bold text-white">
                                    {newRank.tier} {newRank.rank}
                                </h2>
                            </motion.div>
                        </div>

                        {/* Rank progression visual */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center justify-center gap-4 mb-6"
                        >
                            <div className="text-center opacity-50">
                                <div className="text-2xl mb-1">{previousRank.emoji}</div>
                                <div className="text-xs text-gray-400">
                                    {previousRank.tier} {previousRank.rank}
                                </div>
                            </div>

                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.5, type: 'spring' }}
                            >
                                <TrendingUp size={24} className="text-amber-500" />
                            </motion.div>

                            <div className="text-center">
                                <div className="text-2xl mb-1">{newRank.emoji}</div>
                                <div className="text-xs text-white font-medium">
                                    {newRank.tier} {newRank.rank}
                                </div>
                            </div>
                        </motion.div>

                        {/* Motivational message */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="text-center text-gray-400 text-sm mb-6"
                        >
                            {getMotivationalMessage(newRank.tier)}
                        </motion.p>

                        {/* Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            className="space-y-2"
                        >
                            {onShare && (
                                <button
                                    onClick={onShare}
                                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Share2 size={16} />
                                    Share Achievement
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                            >
                                Keep Going
                            </button>
                        </motion.div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

/**
 * Get tier-specific motivational message
 */
function getMotivationalMessage(tier: string): string {
    switch (tier) {
        case 'Reply Guy':
            return 'You\'re making your presence known. Keep engaging authentically!';
        case 'Engager':
            return 'Your replies are getting noticed. You\'re building real connections!';
        case 'Networker':
            return 'You\'re a networking force. People are recognizing your name!';
        case 'Voice':
            return 'Your voice matters in the conversation. Keep amplifying!';
        case 'Authority':
            return 'You\'ve established yourself as an authority. Others look to you!';
        case 'Thought Leader':
            return 'You\'re a thought leader. Your influence is undeniable!';
        default:
            return 'Every engagement builds your presence. Keep at it!';
    }
}

/**
 * Hook to manage rank-up modal state
 */
export function useRankUpModal() {
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        previousRank: TierRankInfo | null;
        newRank: TierRankInfo | null;
    }>({
        isOpen: false,
        previousRank: null,
        newRank: null
    });

    const showRankUp = (previousRank: TierRankInfo, newRank: TierRankInfo) => {
        setModalState({
            isOpen: true,
            previousRank,
            newRank
        });
    };

    const closeRankUp = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
    };

    return {
        isOpen: modalState.isOpen,
        previousRank: modalState.previousRank,
        newRank: modalState.newRank,
        showRankUp,
        closeRankUp
    };
}
