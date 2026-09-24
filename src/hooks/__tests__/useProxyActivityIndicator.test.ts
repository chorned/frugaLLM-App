import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProxyActivityIndicator } from '../useProxyActivityIndicator';

describe('useProxyActivityIndicator hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with null activeProxyState', () => {
    const { result } = renderHook(() => useProxyActivityIndicator());
    expect(result.current.activeProxyState).toBeNull();
  });

  it('immediately activates when is_active is true', () => {
    const { result } = renderHook(() => useProxyActivityIndicator());

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'openrouter',
        is_active: true,
      });
    });

    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'openrouter',
    });
  });

  it('enforces minimum pulse duration to prevent visual flicker on rapid failure', () => {
    const { result } = renderHook(() => useProxyActivityIndicator({ minPulseMs: 250 }));

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'openrouter',
        is_active: true,
      });
    });

    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'openrouter',
    });

    // Advance 50ms (simulating fast upstream 429/401 error)
    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'openrouter',
        is_active: false,
      });
    });

    // Still visible at 50ms because 200ms remain in minimum pulse window
    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'openrouter',
    });

    // Advance 190ms (total elapsed 240ms < 250ms)
    act(() => {
      vi.advanceTimersByTime(190);
    });
    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'openrouter',
    });

    // Advance remaining 10ms (total elapsed 250ms)
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current.activeProxyState).toBeNull();
  });

  it('seamlessly transitions to fallback hop without flashing dead state', () => {
    const { result } = renderHook(() => useProxyActivityIndicator({ minPulseMs: 250 }));

    // 1. Initial attempt to OpenRouter
    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'openrouter',
        is_active: true,
      });
    });

    act(() => {
      vi.advanceTimersByTime(40);
    });

    // 2. OpenRouter drops/fails
    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'openrouter',
        is_active: false,
      });
    });

    // 3. 5ms later, router falls back to Google
    act(() => {
      vi.advanceTimersByTime(5);
    });

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'google',
        is_active: true,
      });
    });

    // Must be on Google immediately, canceling OpenRouter deactivation
    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'google',
    });

    // Advance past original OpenRouter 250ms deadline
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Remains on Google because Google is still active
    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'google',
    });
  });

  it('deactivates immediately if request duration exceeded minimum pulse duration', () => {
    const { result } = renderHook(() => useProxyActivityIndicator({ minPulseMs: 250 }));

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'google',
        is_active: true,
      });
    });

    // Stream lasted 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'google',
        is_active: false,
      });
    });

    // Should deactivate immediately
    expect(result.current.activeProxyState).toBeNull();
  });

  it('automatically resets after safety timeout if deactivation event is lost', () => {
    const { result } = renderHook(() => useProxyActivityIndicator({ safetyTimeoutMs: 5000 }));

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'opencode',
        target: 'ollama',
        is_active: true,
      });
    });

    expect(result.current.activeProxyState).toEqual({
      source: 'opencode',
      target: 'ollama',
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.activeProxyState).toBeNull();
  });

  it('handles request and response phases for bidirectional data flow', () => {
    const { result } = renderHook(() => useProxyActivityIndicator());

    // Phase 1: Inbound request dispatched from user to cloud
    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'opencode',
        target: 'openrouter',
        is_active: true,
        phase: 'request',
      });
    });

    expect(result.current.activeProxyState).toEqual({
      source: 'opencode',
      target: 'openrouter',
      phase: 'request',
    });

    // Phase 2: Response chunks stream back from cloud to user
    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'opencode',
        target: 'openrouter',
        is_active: true,
        phase: 'response',
      });
    });

    expect(result.current.activeProxyState).toEqual({
      source: 'opencode',
      target: 'openrouter',
      phase: 'response',
    });

    // Phase 3: Completion / drop
    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'opencode',
        target: 'openrouter',
        is_active: false,
      });
    });

    // Finished
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.activeProxyState).toBeNull();
  });

  it('switches to response phase during residual pulse on deactivation', () => {
    const { result } = renderHook(() => useProxyActivityIndicator({ minPulseMs: 300 }));

    act(() => {
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'ollama',
        is_active: true,
        phase: 'request',
      });
    });

    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'ollama',
      phase: 'request',
    });

    // Fast finish at 50ms (before minPulseMs)
    act(() => {
      vi.advanceTimersByTime(50);
      result.current.handleProxyActivityEvent({
        source: 'hermes',
        target: 'ollama',
        is_active: false,
      });
    });

    // While residual pulse is playing, it switches to response so return trip is visible
    expect(result.current.activeProxyState).toEqual({
      source: 'hermes',
      target: 'ollama',
      phase: 'response',
    });

    // Advance to end of pulse window
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.activeProxyState).toBeNull();
  });
});
