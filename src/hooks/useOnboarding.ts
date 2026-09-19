import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type OnboardingState = 'fresh' | 'learning' | 'completed';
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface UseOnboardingOptions {
  isHermesInstalled?: boolean;
  isOpenCodeInstalled?: boolean;
  isOllamaInstalled?: boolean;
  hasGoogleKey?: boolean;
  hasOpenRouterKey?: boolean;
}

export function useOnboarding(options?: UseOnboardingOptions) {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>('fresh');
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [isFooterDismissed, setIsFooterDismissed] = useState<boolean>(false);
  const [hasSourceLinkedInternal, setHasSourceLinkedInternal] = useState<boolean>(false);
  const [hasHarnessInstalledInternal, setHasHarnessInstalledInternal] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const [ollama, hermes, opencode, googleKey, openrouterKey] = await Promise.allSettled([
        invoke<any>('check_ollama_status'),
        invoke<any>('check_hermes_status'),
        invoke<any>('check_opencode_status'),
        invoke<string | null>('get_credential', { service: 'google' }),
        invoke<string | null>('get_credential', { service: 'openrouter' }),
      ]);

      const isOllama =
        ollama.status === 'fulfilled' &&
        (typeof ollama.value === 'boolean' ? ollama.value : Boolean(ollama.value?.is_installed));

      const isGoogle =
        googleKey.status === 'fulfilled' &&
        Boolean(googleKey.value && typeof googleKey.value === 'string' && googleKey.value.trim().length > 0);

      const isOpenRouter =
        openrouterKey.status === 'fulfilled' &&
        Boolean(openrouterKey.value && typeof openrouterKey.value === 'string' && openrouterKey.value.trim().length > 0);

      const isHermes =
        hermes.status === 'fulfilled' &&
        (typeof hermes.value === 'boolean' ? hermes.value : Boolean(hermes.value?.is_installed));

      const isOpenCode =
        opencode.status === 'fulfilled' &&
        (typeof opencode.value === 'boolean' ? opencode.value : Boolean(opencode.value?.is_installed));

      setHasSourceLinkedInternal(Boolean(isOllama || isGoogle || isOpenRouter));
      setHasHarnessInstalledInternal(Boolean(isHermes || isOpenCode));
    } catch (e) {
      // Graceful fallback for offline / mock testing environments
      console.error('Failed to detect onboarding status', e);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const isWipe = await invoke<boolean>('is_wipe_mode');
        if (isWipe) {
          localStorage.removeItem('onboardingState');
          localStorage.removeItem('onboardingStep');
          localStorage.removeItem('onboarding_footer_dismissed');
          setOnboardingState('fresh');
          setCurrentStep(1);
          setIsFooterDismissed(false);
          setIsLoaded(true);
          return;
        }
      } catch (e) {
        console.error('Failed to check wipe mode', e);
      }

      const state = localStorage.getItem('onboardingState');
      if (state === 'learning' || state === 'completed') {
        setOnboardingState(state);
      }

      const savedStep = localStorage.getItem('onboardingStep');
      if (savedStep) {
        const parsed = parseInt(savedStep, 10);
        if (parsed >= 1 && parsed <= 6) {
          setCurrentStep(parsed as OnboardingStep);
        }
      }

      const dismissed = localStorage.getItem('onboarding_footer_dismissed');
      if (dismissed === 'true') {
        setIsFooterDismissed(true);
      }

      await checkStatus();
      setIsLoaded(true);
    }

    init();
  }, [checkStatus]);

  const handleDecision = useCallback((decision: 'learning' | 'completed') => {
    localStorage.setItem('onboardingState', decision);
    setOnboardingState(decision);
    if (decision === 'learning') {
      setCurrentStep(1);
      localStorage.setItem('onboardingStep', '1');
    }
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.min(6, prev + 1) as OnboardingStep;
      localStorage.setItem('onboardingStep', String(next));
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(1, prev - 1) as OnboardingStep;
      localStorage.setItem('onboardingStep', String(next));
      return next;
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    const clamped = Math.max(1, Math.min(6, Math.round(step))) as OnboardingStep;
    setCurrentStep(clamped);
    localStorage.setItem('onboardingStep', String(clamped));
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem('onboardingState');
    localStorage.removeItem('onboardingStep');
    localStorage.removeItem('onboarding_footer_dismissed');
    setOnboardingState('fresh');
    setCurrentStep(1);
    setIsFooterDismissed(false);
  }, []);

  const dismissFooter = useCallback(() => {
    localStorage.setItem('onboarding_footer_dismissed', 'true');
    setIsFooterDismissed(true);
  }, []);

  const hasSourceLinked =
    Boolean(options?.isOllamaInstalled || options?.hasGoogleKey || options?.hasOpenRouterKey) ||
    hasSourceLinkedInternal;

  const hasHarnessInstalled =
    Boolean(options?.isHermesInstalled || options?.isOpenCodeInstalled) ||
    hasHarnessInstalledInternal;

  return {
    onboardingState,
    currentStep,
    isFooterDismissed,
    hasSourceLinked,
    hasHarnessInstalled,
    isLoaded,
    handleDecision,
    nextStep,
    prevStep,
    goToStep,
    resetTour,
    dismissFooter,
    checkStatus,
  };
}
