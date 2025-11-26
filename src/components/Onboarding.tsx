import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Zap, MessageCircle, ArrowRight } from 'lucide-react';

interface OnboardingProps {
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-xl">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-panel w-[420px] p-6 rounded-xl border border-white/10 relative overflow-hidden"
            >
                {/* Header */}
                <div className="mb-6">
                    <div className="text-xs text-amber-500 uppercase tracking-widest mb-2">Welcome to Amendoa</div>
                    <h2 className="text-2xl font-semibold text-white">Start tracking in 3 steps</h2>
                </div>

                {/* Steps */}
                <div className="space-y-4 mb-6">
                    <div className="flex gap-4 items-start p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <UserPlus size={16} className="text-amber-500" />
                        </div>
                        <div>
                            <div className="text-white font-medium text-sm">Visit any profile</div>
                            <div className="text-white/50 text-xs mt-0.5">
                                Browse Twitter and find people you want to engage with
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Zap size={16} className="text-amber-500" />
                        </div>
                        <div>
                            <div className="text-white font-medium text-sm">Click "Track in Amendoa"</div>
                            <div className="text-white/50 text-xs mt-0.5">
                                You'll see this button below their bio. Pick a tier and you're done.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <MessageCircle size={16} className="text-amber-500" />
                        </div>
                        <div>
                            <div className="text-white font-medium text-sm">Reply to scored tweets</div>
                            <div className="text-white/50 text-xs mt-0.5">
                                Their tweets appear in your Reply Queue, scored by opportunity
                            </div>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <button
                    onClick={onComplete}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    Got it, let's go
                    <ArrowRight size={16} />
                </button>

                <p className="text-center text-white/30 text-xs mt-4">
                    Tip: Start with 3-5 accounts you genuinely want to engage with
                </p>
            </motion.div>
        </div>
    );
};
