import { useState, useRef, useEffect, useCallback } from 'react';

export interface ProxyActivityPayload {
  source: string;
  target: string;
  is_active: boolean;
  phase?: 'request' | 'response';
}

export interface ProxyActivityState {
  source: string;
  target: string;
  phase?: 'request' | 'response';
}

export interface UseProxyActivityIndicatorOptions {
  minPulseMs?: number;
  safetyTimeoutMs?: number;
}

export function useProxyActivityIndicator(options?: UseProxyActivityIndicatorOptions) {
  const minPulseMs = options?.minPulseMs ?? 250;
  const safetyTimeoutMs = options?.safetyTimeoutMs ?? 120000;

  const [activeProxyState, setActiveProxyState] = useState<ProxyActivityState | null>(null);
  const safetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deactivateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStartTime = useRef<number>(0);

  const handleProxyActivityEvent = useCallback(
    (payload: ProxyActivityPayload) => {
      // Clear safety timeout if active
      if (safetyTimeout.current) {
        clearTimeout(safetyTimeout.current);
        safetyTimeout.current = null;
      }
      // Clear any pending pulse deactivation timeout
      if (deactivateTimeout.current) {
        clearTimeout(deactivateTimeout.current);
        deactivateTimeout.current = null;
      }

      if (payload.is_active) {
        activeStartTime.current = Date.now();
        const nextState: ProxyActivityState = {
          source: payload.source,
          target: payload.target,
        };
        if (payload.phase) {
          nextState.phase = payload.phase;
        }
        setActiveProxyState(nextState);
        // Fallback safety timeout in case the drop event is lost
        safetyTimeout.current = setTimeout(() => {
          setActiveProxyState(null);
          safetyTimeout.current = null;
        }, safetyTimeoutMs);
      } else {
        const elapsed = Date.now() - (activeStartTime.current || 0);
        if (elapsed < minPulseMs) {
          // If deactivated during minimum pulse window and currently in request phase, transition to response phase during residual pulse
          setActiveProxyState((curr) => (curr ? (curr.phase ? { ...curr, phase: 'response' } : curr) : null));
          deactivateTimeout.current = setTimeout(() => {
            setActiveProxyState(null);
            deactivateTimeout.current = null;
          }, minPulseMs - elapsed);
        } else {
          setActiveProxyState(null);
        }
      }
    },
    [minPulseMs, safetyTimeoutMs]
  );

  const cleanup = useCallback(() => {
    if (safetyTimeout.current) {
      clearTimeout(safetyTimeout.current);
      safetyTimeout.current = null;
    }
    if (deactivateTimeout.current) {
      clearTimeout(deactivateTimeout.current);
      deactivateTimeout.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    activeProxyState,
    handleProxyActivityEvent,
    cleanup,
  };
}
