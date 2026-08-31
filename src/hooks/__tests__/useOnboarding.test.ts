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
    (invoke as any).mockResolvedValueOnce(false); // is_wipe_mode = false

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('fresh');
    expect(invoke).toHaveBeenCalledWith('is_wipe_mode');
  });

  it('restores stored "learning" or "completed" state from localStorage', async () => {
    // Arrange
    localStorage.setItem('onboardingState', 'completed');
    (invoke as any).mockResolvedValueOnce(false);

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('completed');
  });

  it('clears stored onboarding state when is_wipe_mode returns true', async () => {
    // Arrange
    localStorage.setItem('onboardingState', 'completed');
    (invoke as any).mockResolvedValueOnce(true); // is_wipe_mode = true

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('fresh');
    expect(localStorage.getItem('onboardingState')).toBeNull();
  });

  it('handles Tauri invoke failure gracefully and falls back to existing localStorage state', async () => {
    // Arrange
    localStorage.setItem('onboardingState', 'learning');
    (invoke as any).mockRejectedValueOnce(new Error('Tauri IPC offline'));

    // Act
    const { result } = renderHook(() => useOnboarding());

    // Assert
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.onboardingState).toBe('learning');
  });

  it('updates state and persists to localStorage when handleDecision is called', async () => {
    // Arrange
    (invoke as any).mockResolvedValueOnce(false);
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    // Act 1: Select learning
    act(() => {
      result.current.handleDecision('learning');
    });

    // Assert 1
    expect(result.current.onboardingState).toBe('learning');
    expect(localStorage.getItem('onboardingState')).toBe('learning');

    // Act 2: Select completed
    act(() => {
      result.current.handleDecision('completed');
    });

    // Assert 2
    expect(result.current.onboardingState).toBe('completed');
    expect(localStorage.getItem('onboardingState')).toBe('completed');
  });
});
