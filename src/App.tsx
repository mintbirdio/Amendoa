import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Onboarding } from './components/Onboarding';

const App: React.FC = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    // Check if onboarded
    const onboarded = localStorage.getItem('amendoa_onboarded');
    if (onboarded) setIsOnboarded(true);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('amendoa_onboarded', 'true');
    setIsOnboarded(true);
  };

  return (
    <>
      {!isOnboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        <Sidebar />
      )}
    </>
  );
};

export default App;
