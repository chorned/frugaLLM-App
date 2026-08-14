import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type OnboardingState = 'fresh' | 'learning' | 'completed';

export function useOnboarding() {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>('fresh');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const isWipe = await invoke<boolean>('is_wipe_mode');
        if (isWipe) {
          localStorage.removeItem('onboardingState');
        }
      } catch (e) {
        console.error('Failed to check wipe mode', e);
      }

      const state = localStorage.getItem('onboardingState');
      if (state === 'learning' || state === 'completed') {
        setOnboardingState(state);
      }
      setIsLoaded(true);
    }
    init();
  }, []);

  const handleDecision = (decision: 'learning' | 'completed') => {
    localStorage.setItem('onboardingState', decision);
    setOnboardingState(decision);
  };

  return { onboardingState, handleDecision, isLoaded };
}
