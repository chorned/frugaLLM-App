import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, ReactNode } from 'react';
import {
  HardwareProfile,
  MemorySegments,
  GRAPH_OVERHEAD_GB,
  getRecommendedModelForVram,
  computeMemorySegmentsForModel,
} from '../services/memoryCalculator';

let isScreenshotMode = () => false;
let APPSTORE_TELEMETRY: any = null;

if (import.meta.env.DEV) {
  const mod = await import('../dev/screenshotMode');
  isScreenshotMode = mod.isScreenshotMode;
  APPSTORE_TELEMETRY = mod.APPSTORE_TELEMETRY;
}

export interface MemoryContextType {
  activeModelName: string;
  defaultRecommendedModel: string;
  detectedVramGb: number;
  hardwareProfile: HardwareProfile | null;
  latestTelemetry: any;
  isLive: boolean;
  weightsGb: number;
  kvCacheGb: number;
  overheadGb: number;
  totalFootprintGb: number;
  spilloverGb: number;
  spilloverType: 'none' | 'system_ram' | 'ssd_swap';
  triggersWarning: boolean;
  warningMessage: string;
  effectiveSegments: MemorySegments;
  setActiveModelName: (name: string) => void;
  setDetectedVramGb: (gb: number) => void;
  setHardwareProfile: (profile: HardwareProfile | null) => void;
  setLatestTelemetry: (telemetry: any) => void;
}

const MemoryContext = createContext<MemoryContextType | null>(null);

export const MemoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [detectedVramGb, setDetectedVramGbState] = useState<number>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return 16;
    return 8;
  });
  const [hardwareProfile, setHardwareProfileState] = useState<HardwareProfile | null>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return (APPSTORE_TELEMETRY as any)?.hardware_profile;
    return null;
  });
  const [latestTelemetry, setLatestTelemetryState] = useState<any>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return APPSTORE_TELEMETRY;
    return null;
  });
  const [customModelName, setCustomModelName] = useState<string>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return 'llama3.3:70b-instruct';
    return '';
  });

  const defaultRecommendedModel = useMemo(() => {
    return getRecommendedModelForVram(detectedVramGb);
  }, [detectedVramGb]);

  // When detected VRAM changes, reset custom override so activeModelName tracks recommendation
  useEffect(() => {
    setCustomModelName('');
  }, [detectedVramGb]);

  const activeModelName = customModelName || defaultRecommendedModel;

  const isLive = latestTelemetry?.segments?.phase === 'live';
  const isUnified = hardwareProfile?.is_unified ?? false;
  const ceilingBytes =
    latestTelemetry?.segments?.execution_ceiling_bytes ||
    hardwareProfile?.execution_ceiling ||
    detectedVramGb * 1024 * 1024 * 1024;

  const effectiveSegments = useMemo(() => {
    // Only trust raw telemetry segments during LIVE runtime when the
    // telemetry model matches what the user has active. In all other cases,
    // compute fresh segments from the activeModelName lookup table.
    if (
      isLive &&
      latestTelemetry?.segments &&
      latestTelemetry?.ollama?.model_name &&
      activeModelName === latestTelemetry.ollama.model_name
    ) {
      return latestTelemetry.segments;
    }
    // Always compute from the frontend model lookup table
    return computeMemorySegmentsForModel(
      activeModelName,
      ceilingBytes,
      isUnified,
      false, // pre-flight when not matching live telemetry
      0
    );
  }, [activeModelName, ceilingBytes, isUnified, isLive, latestTelemetry]);

  const weightsGb = effectiveSegments.weights_bytes / 1024 / 1024 / 1024;
  const kvCacheGb = effectiveSegments.context_128k_bytes / 1024 / 1024 / 1024;
  const overheadGb = effectiveSegments.overhead_bytes / 1024 / 1024 / 1024;
  const totalFootprintGb = effectiveSegments.total_projected_bytes / 1024 / 1024 / 1024;
  const spilloverGb = effectiveSegments.spillover_bytes / 1024 / 1024 / 1024;
  const spilloverType = effectiveSegments.spillover_type as 'none' | 'system_ram' | 'ssd_swap';
  const triggersWarning = effectiveSegments.triggers_warning || effectiveSegments.spillover_bytes > 0;
  const warningMessage = effectiveSegments.warning_message;

  const setActiveModelName = useCallback((name: string) => {
    setCustomModelName(name);
  }, []);

  const setDetectedVramGb = useCallback((gb: number) => {
    setDetectedVramGbState(gb);
  }, []);

  const setHardwareProfile = useCallback((profile: HardwareProfile | null) => {
    setHardwareProfileState(profile);
  }, []);

  const setLatestTelemetry = useCallback((telemetry: any) => {
    setLatestTelemetryState(telemetry);
  }, []);

  const value = useMemo(
    () => ({
      activeModelName,
      defaultRecommendedModel,
      detectedVramGb,
      hardwareProfile,
      latestTelemetry,
      isLive,
      weightsGb,
      kvCacheGb,
      overheadGb,
      totalFootprintGb,
      spilloverGb,
      spilloverType,
      triggersWarning,
      warningMessage,
      effectiveSegments,
      setActiveModelName,
      setDetectedVramGb,
      setHardwareProfile,
      setLatestTelemetry,
    }),
    [
      activeModelName,
      defaultRecommendedModel,
      detectedVramGb,
      hardwareProfile,
      latestTelemetry,
      isLive,
      weightsGb,
      kvCacheGb,
      overheadGb,
      totalFootprintGb,
      spilloverGb,
      spilloverType,
      triggersWarning,
      warningMessage,
      effectiveSegments,
      setActiveModelName,
      setDetectedVramGb,
      setHardwareProfile,
      setLatestTelemetry,
    ]
  );

  return <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>;
};

export function useMemory(): MemoryContextType {
  const context = useContext(MemoryContext);
  if (!context) {
    // Fallback if rendered outside provider
    const fallbackSegments = computeMemorySegmentsForModel('gemma4:e2b', 8 * 1024 * 1024 * 1024);
    return {
      activeModelName: 'gemma4:e2b',
      defaultRecommendedModel: 'gemma4:e2b',
      detectedVramGb: 8,
      hardwareProfile: null,
      latestTelemetry: null,
      isLive: false,
      weightsGb: 1.4,
      kvCacheGb: 1.29,
      overheadGb: GRAPH_OVERHEAD_GB,
      totalFootprintGb: 3.19,
      spilloverGb: 0,
      spilloverType: 'none',
      triggersWarning: false,
      warningMessage: '',
      effectiveSegments: fallbackSegments,
      setActiveModelName: () => {},
      setDetectedVramGb: () => {},
      setHardwareProfile: () => {},
      setLatestTelemetry: () => {},
    };
  }
  return context;
}

