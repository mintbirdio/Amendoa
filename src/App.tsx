import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Onboarding } from './components/Onboarding';
import { RankUpModal, useRankUpModal } from './components/RankUpModal';
import { type TierRankInfo } from './services/gamification';
import { generateAndShare } from './services/statsImageGenerator';

const App: React.FC = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const { isOpen, previousRank, newRank, showRankUp, closeRankUp } = useRankUpModal();

  useEffect(() => {
    // Check if onboarded
    const onboarded = localStorage.getItem('amendoa_onboarded');
    if (onboarded) setIsOnboarded(true);
  }, []);

  // Listen for rank-up events from XP earned
  useEffect(() => {
    const handleXPEarned = (event: CustomEvent<{
      didRankUp: boolean;
      previousRankInfo: TierRankInfo;
      rankInfo: TierRankInfo;
    }>) => {
      if (event.detail.didRankUp) {
        showRankUp(event.detail.previousRankInfo, event.detail.rankInfo);
      }
    };

    window.addEventListener('AMENDOA_XP_EARNED', handleXPEarned as EventListener);
    return () => window.removeEventListener('AMENDOA_XP_EARNED', handleXPEarned as EventListener);
  }, [showRankUp]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('amendoa_onboarded', 'true');
    setIsOnboarded(true);
  };

  const handleShare = useCallback(() => {
    if (previousRank && newRank) {
      generateAndShare({
        type: 'rank-up',
        previousTier: previousRank.tier,
        previousRank: previousRank.rank,
        newTier: newRank.tier,
        newRank: newRank.rank
      });
    }
    closeRankUp();
  }, [closeRankUp, previousRank, newRank]);

  return (
    <>
      {!isOnboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        <Sidebar />
      )}

      {/* Rank-up modal - shows above everything */}
      {previousRank && newRank && (
        <RankUpModal
          isOpen={isOpen}
          onClose={closeRankUp}
          previousRank={previousRank}
          newRank={newRank}
          onShare={handleShare}
        />
      )}
    </>
  );
};

export default App;
