import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryProvider, useMemory } from '../MemoryContext';
import { HardwareProfile } from '../../services/memoryCalculator';

describe('MemoryContext & useMemory Hook', () => {
  it('returns safe fallback default state when used outside of MemoryProvider', () => {
    // Act
    const { result } = renderHook(() => useMemory());

    // Assert
    expect(result.current.activeModelName).toBe('gemma4:e2b');
    expect(result.current.detectedVramGb).toBe(8);
    expect(result.current.hardwareProfile).toBeNull();
    expect(result.current.isLive).toBe(false);
    expect(result.current.triggersWarning).toBe(false);
    expect(result.current.spilloverType).toBe('none');
    expect(typeof result.current.setActiveModelName).toBe('function');
  });

  it('provides initialized context values with MemoryProvider wrapper', () => {
    // Arrange & Act
    const { result } = renderHook(() => useMemory(), {
      wrapper: ({ children }) => <MemoryProvider>{children}</MemoryProvider>,
    });

    // Assert
    expect(result.current.detectedVramGb).toBe(8);
    expect(result.current.defaultRecommendedModel).toBe('gemma4:e2b'); // 8GB fits e2b (3.19GB) because e4b requires 8.5GB
    expect(result.current.activeModelName).toBe('gemma4:e2b');
    expect(result.current.isLive).toBe(false);
    expect(result.current.spilloverGb).toBe(0);
  });

  it('updates recommended and active model when detectedVramGb changes', () => {
    // Arrange
    const { result } = renderHook(() => useMemory(), {
      wrapper: ({ children }) => <MemoryProvider>{children}</MemoryProvider>,
    });

    // Act: Set VRAM to 48 GB
    act(() => {
      result.current.setDetectedVramGb(48);
    });

    // Assert: Recommendation should update to 31b
    expect(result.current.detectedVramGb).toBe(48);
    expect(result.current.defaultRecommendedModel).toBe('gemma4:31b');
    expect(result.current.activeModelName).toBe('gemma4:31b');
  });

  it('allows custom model override, and resets override when detectedVramGb changes', () => {
    // Arrange
    const { result } = renderHook(() => useMemory(), {
      wrapper: ({ children }) => <MemoryProvider>{children}</MemoryProvider>,
    });

    // Act 1: Manually select a custom model
    act(() => {
      result.current.setActiveModelName('gemma4:26b');
    });

    // Assert 1: activeModelName is custom
    expect(result.current.activeModelName).toBe('gemma4:26b');

    // Act 2: VRAM changes from backend polling
    act(() => {
      result.current.setDetectedVramGb(18); // fits 12b
    });

    // Assert 2: Custom override is cleared and follows new recommendation
    expect(result.current.defaultRecommendedModel).toBe('gemma4:12b');
    expect(result.current.activeModelName).toBe('gemma4:12b');
  });

  it('computes spillover warning when model exceeds hardware ceiling', () => {
    // Arrange
    const { result } = renderHook(() => useMemory(), {
      wrapper: ({ children }) => <MemoryProvider>{children}</MemoryProvider>,
    });

    const mockProfile: HardwareProfile = {
      is_unified: false,
      dedicated_vram: 8 * 1024 * 1024 * 1024, // 8GB
      system_ram: 32 * 1024 * 1024 * 1024,
      execution_ceiling: 8 * 1024 * 1024 * 1024,
      os_architecture: 'macos-x86_64',
    };

    // Act: Set profile and manually select a 31b model which requires ~43.86GB
    act(() => {
      result.current.setHardwareProfile(mockProfile);
      result.current.setActiveModelName('gemma4:31b');
    });

    // Assert
    expect(result.current.triggersWarning).toBe(true);
    expect(result.current.spilloverGb).toBeGreaterThan(0);
    expect(result.current.spilloverType).toBe('system_ram');
    expect(result.current.warningMessage).toContain('exceed Dedicated VRAM');
  });

  it('trusts live telemetry segments only when phase is live AND model matches active model', () => {
    // Arrange
    const { result } = renderHook(() => useMemory(), {
      wrapper: ({ children }) => <MemoryProvider>{children}</MemoryProvider>,
    });

    const liveMatchingTelemetry = {
      segments: {
        phase: 'live',
        weights_bytes: 15_000_000_000,
        context_128k_bytes: 4_000_000_000,
        overhead_bytes: 524_288_000,
        total_projected_bytes: 19_524_288_000,
        execution_ceiling_bytes: 24_000_000_000,
        spillover_bytes: 0,
        spillover_type: 'none',
        triggers_warning: false,
        warning_message: '',
      },
      ollama: {
        model_name: 'gemma4:12b',
      },
    };

    // Act 1: Set matching active model and telemetry
    act(() => {
      result.current.setActiveModelName('gemma4:12b');
      result.current.setLatestTelemetry(liveMatchingTelemetry);
    });

    // Assert 1: Context reflects live telemetry values
    expect(result.current.isLive).toBe(true);
    expect(result.current.effectiveSegments.weights_bytes).toBe(15_000_000_000);

    // Act 2: Telemetry has mismatched model
    const mismatchedTelemetry = {
      ...liveMatchingTelemetry,
      ollama: {
        model_name: 'different-model-ollama',
      },
    };

    act(() => {
      result.current.setLatestTelemetry(mismatchedTelemetry);
    });

    // Assert 2: Falls back to computing segments from activeModelName lookup
    expect(result.current.effectiveSegments.weights_bytes).toBe(Math.round(13.0 * 1024 * 1024 * 1024));
  });
});
