import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { useOnboarding } from '../useOnboarding';

describe('useOnboarding Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes to "fresh" when localStorage has no existing state', async () => {
    // Arrange
    (invoke as any).mockResolvedValue(false); // default mock

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('fresh');
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isFooterDismissed).toBe(false);
    expect(invoke).toHaveBeenCalledWith('is_wipe_mode');
  });

  it('restores stored "learning" or "completed" state and step from localStorage', async () => {
    // Arrange
    localStorage.setItem('onboardingState', 'learning');
    localStorage.setItem('onboardingStep', '3');
    localStorage.setItem('onboarding_footer_dismissed', 'true');
    (invoke as any).mockResolvedValue(false);

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('learning');
    expect(result.current.currentStep).toBe(3);
    expect(result.current.isFooterDismissed).toBe(true);
  });

  it('clears stored onboarding state when is_wipe_mode returns true', async () => {
    // Arrange
    localStorage.setItem('onboardingState', 'completed');
    localStorage.setItem('onboardingStep', '5');
    localStorage.setItem('onboarding_footer_dismissed', 'true');
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(true);
      return Promise.resolve(false);
    });

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('fresh');
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isFooterDismissed).toBe(false);
    expect(localStorage.getItem('onboardingState')).toBeNull();
    expect(localStorage.getItem('onboardingStep')).toBeNull();
    expect(localStorage.getItem('onboarding_footer_dismissed')).toBeNull();
  });

  it('handles Tauri invoke failure gracefully and falls back to existing localStorage state', async () => {
    // Arrange
    localStorage.setItem('onboardingState', 'learning');
    (invoke as any).mockRejectedValue(new Error('Tauri IPC offline'));

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('learning');
  });

  it('updates state and step when handleDecision is called', async () => {
    // Arrange
    (invoke as any).mockResolvedValue(false);
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    // Act 1: Select learning
    act(() => {
      result.current.handleDecision('learning');
    });

    // Assert 1
    expect(result.current.onboardingState).toBe('learning');
    expect(result.current.currentStep).toBe(1);
    expect(localStorage.getItem('onboardingState')).toBe('learning');
    expect(localStorage.getItem('onboardingStep')).toBe('1');

    // Act 2: Select completed
    act(() => {
      result.current.handleDecision('completed');
    });

    // Assert 2
    expect(result.current.onboardingState).toBe('completed');
    expect(localStorage.getItem('onboardingState')).toBe('completed');
  });

  it('navigates through steps using nextStep, prevStep, and goToStep within 1-6 bounds', async () => {
    // Arrange
    (invoke as any).mockResolvedValue(false);
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.handleDecision('learning');
    });
    expect(result.current.currentStep).toBe(1);

    // Next step
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(2);
    expect(localStorage.getItem('onboardingStep')).toBe('2');

    // Go to step 5
    act(() => {
      result.current.goToStep(5);
    });
    expect(result.current.currentStep).toBe(5);
    expect(localStorage.getItem('onboardingStep')).toBe('5');

    // Next step to 6
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(6);

    // Next step should clamp at 6
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(6);

    // Prev step to 5
    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(5);

    // Prev step down to 1 and clamp
    act(() => {
      result.current.goToStep(1);
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(1);
  });

  it('resets tour cleanly when resetTour is called', async () => {
    // Arrange
    (invoke as any).mockResolvedValue(false);
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.handleDecision('learning');
      result.current.goToStep(4);
      result.current.dismissFooter();
    });
    expect(result.current.onboardingState).toBe('learning');
    expect(result.current.currentStep).toBe(4);
    expect(result.current.isFooterDismissed).toBe(true);

    // Act
    act(() => {
      result.current.resetTour();
    });

    // Assert
    expect(result.current.onboardingState).toBe('fresh');
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isFooterDismissed).toBe(false);
    expect(localStorage.getItem('onboardingState')).toBeNull();
    expect(localStorage.getItem('onboardingStep')).toBeNull();
    expect(localStorage.getItem('onboarding_footer_dismissed')).toBeNull();
  });

  it('persists footer dismissal when dismissFooter is called', async () => {
    // Arrange
    (invoke as any).mockResolvedValue(false);
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.isFooterDismissed).toBe(false);

    // Act
    act(() => {
      result.current.dismissFooter();
    });

    // Assert
    expect(result.current.isFooterDismissed).toBe(true);
    expect(localStorage.getItem('onboarding_footer_dismissed')).toBe('true');
  });

  it('detects active sources and harnesses from backend IPC and caller options', async () => {
    // Arrange
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'check_ollama_status') return Promise.resolve({ is_installed: true, is_managed: false });
      if (cmd === 'check_hermes_status') return Promise.resolve({ is_installed: true, is_managed: false });
      if (cmd === 'check_opencode_status') return Promise.resolve({ is_installed: false, is_managed: false });
      if (cmd === 'get_credential') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.hasSourceLinked).toBe(true);
    expect(result.current.hasHarnessInstalled).toBe(true);
  });

  it('detects active sources in wipe mode when credentials exist in backend', async () => {
    // Arrange
    (invoke as any).mockImplementation((cmd: string, args: any) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(true);
      if (cmd === 'check_ollama_status') return Promise.resolve({ is_installed: false, is_managed: false });
      if (cmd === 'check_hermes_status') return Promise.resolve({ is_installed: false, is_managed: false });
      if (cmd === 'check_opencode_status') return Promise.resolve({ is_installed: false, is_managed: false });
      if (cmd === 'get_credential' && args?.service === 'google') return Promise.resolve('AIzaSy_test');
      if (cmd === 'get_credential' && args?.service === 'openrouter') return Promise.resolve('sk-or_test');
      return Promise.resolve(null);
    });

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('fresh');
    expect(result.current.hasSourceLinked).toBe(true);
  });

  it('respects hasSourceLinked and hasHarnessInstalled passed directly in options', async () => {
    // Arrange
    (invoke as any).mockResolvedValue(false);

    // Act
    const { result } = renderHook(() =>
      useOnboarding({
        hasSourceLinked: true,
        hasHarnessInstalled: true,
      })
    );

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.hasSourceLinked).toBe(true);
    expect(result.current.hasHarnessInstalled).toBe(true);
  });

  it('dynamically updates hasSourceLinked when checkStatus is invoked', async () => {
    // Arrange
    let hasGoogle = false;
    (invoke as any).mockImplementation((cmd: string, args: any) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'get_credential' && args?.service === 'google') {
        return Promise.resolve(hasGoogle ? 'AIzaSy_dynamic_key' : null);
      }
      return Promise.resolve(false);
    });

    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.hasSourceLinked).toBe(false);

    // Act: Simulate external key addition and status check
    hasGoogle = true;
    await act(async () => {
      await result.current.checkStatus();
    });

    // Assert
    expect(result.current.hasSourceLinked).toBe(true);
  });
});
