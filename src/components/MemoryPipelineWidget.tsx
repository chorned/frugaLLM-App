import React from 'react';
import { AlertTriangle, AlertOctagon, Zap, HardDrive, Layers, Sparkles } from 'lucide-react';

import { useMemory } from '../context/MemoryContext';
import {
  HardwareProfile,
  MemorySegments,
  computeMemorySegmentsForModel,
} from '../services/memoryCalculator';

export type { HardwareProfile, MemorySegments, ModelProfile } from '../services/memoryCalculator';

interface MemoryPipelineWidgetProps {
  segments?: MemorySegments;
  hardwareProfile?: HardwareProfile;
  compact?: boolean;
  modelTag?: string;
}

export const MemoryPipelineWidget: React.FC<MemoryPipelineWidgetProps> = ({
  segments,
  hardwareProfile,
  compact = false,
  modelTag,
}) => {
  const memory = useMemory();

  const isLive = (segments || memory.effectiveSegments)?.phase === 'live';
  const effectiveHardwareProfile = hardwareProfile || memory.hardwareProfile;
  const isUnified = effectiveHardwareProfile?.is_unified ?? false;
  const ceilingBytes =
    segments?.execution_ceiling_bytes ||
    effectiveHardwareProfile?.execution_ceiling ||
    memory.effectiveSegments?.execution_ceiling_bytes ||
    8 * 1024 * 1024 * 1024;

  // Segment resolution priority:
  // 1. If modelTag is provided (modal context) → ALWAYS compute fresh from the model lookup table.
  //    This ensures the modal renders the correct math for the active model name, not stale telemetry.
  // 2. If segments prop is provided WITHOUT modelTag (telemetry context) → trust the raw segments.
  //    The HardwareTelemetryWidget and NodeWidgets pass telemetry segments directly.
  // 3. Fall back to the global store's effectiveSegments.
  const effectiveSegments: MemorySegments = (() => {
    // Modal context: modelTag means we're rendering for a specific model selection
    if (modelTag) {
      return computeMemorySegmentsForModel(modelTag, ceilingBytes, isUnified, isLive, 0);
    }
    
    // Telemetry context: raw segments from backend telemetry events
    if (segments) {
      return segments;
    }
    
    // Default: use the global store's computed segments
    return memory.effectiveSegments;
  })();

  const weightsBytes = effectiveSegments.weights_bytes;
  const contextBytes = effectiveSegments.context_128k_bytes;
  const overheadBytes = effectiveSegments.overhead_bytes;
  const spilloverBytes = effectiveSegments.spillover_bytes;
  const spilloverType = effectiveSegments.spillover_type;
  const triggersWarning = effectiveSegments.triggers_warning || spilloverBytes > 0;
  const warningMessage = effectiveSegments.warning_message;
  const isUnknown = effectiveSegments.is_unknown;

  const totalRequiredBytes = weightsBytes + contextBytes + overheadBytes;
  const maxScaleBytes = Math.max(ceilingBytes, totalRequiredBytes);

  const toGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1);

  // Percentages of the visual bar container
  const weightsPct = (weightsBytes / maxScaleBytes) * 100;
  const contextPct = (contextBytes / maxScaleBytes) * 100;
  const overheadPct = (overheadBytes / maxScaleBytes) * 100;
  const spilloverPct = (spilloverBytes / maxScaleBytes) * 100;

  const stripedTexture = 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.18) 6px, transparent 6px, transparent 12px)';

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
          <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers style={{ width: '11px', height: '11px' }} />
            {isLive ? 'Live Memory Footprint' : 'Pre-Flight 128k Allocation'}
          </span>
          <span style={{ color: isLive ? 'var(--zen-success)' : 'var(--zen-accent)', fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: isLive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(59, 130, 246, 0.12)' }}>
            {isLive ? 'LIVE' : 'ESTIMATED'}
          </span>
        </div>

        {/* Stacked Bar Container */}
        <div
          data-testid="compact-memory-stacked-bar"
          style={{
            display: 'flex',
            width: '100%',
            height: '8px',
            backgroundColor: '#1e293b',
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
            position: 'relative'
          }}
        >
          {isUnknown ? (
            <div
              title="Unknown Model Footprint"
              style={{
                width: '100%',
                backgroundColor: '#4b5563',
                backgroundImage: stripedTexture,
              }}
            />
          ) : (
            <>
              {/* Blue: Weights */}
              <div
                title={`Weights: ${toGB(weightsBytes)} GB`}
                style={{
                  width: `${weightsPct}%`,
                  backgroundColor: '#3b82f6',
                  backgroundImage: !isLive ? stripedTexture : undefined,
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
              {/* Purple: 128k Q8 Context */}
              <div
                title={`128k Q8 Context: ${toGB(contextBytes)} GB`}
                style={{
                  width: `${contextPct}%`,
                  backgroundColor: '#a855f7',
                  backgroundImage: !isLive ? stripedTexture : undefined,
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
              {/* Gray: Overhead */}
              <div
                title={`Overhead: ${toGB(overheadBytes)} GB`}
                style={{
                  width: `${overheadPct}%`,
                  backgroundColor: '#6b7280',
                  backgroundImage: !isLive ? stripedTexture : undefined,
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
              {/* Spillover: Yellow (System RAM) or Red (SSD Swap) */}
              {spilloverBytes > 0 && (
                <div
                  title={`${spilloverType === 'ssd_swap' ? 'SSD Swap' : 'System RAM'} Spillover: ${toGB(spilloverBytes)} GB`}
                  style={{
                    width: `${spilloverPct}%`,
                    backgroundColor: spilloverType === 'ssd_swap' ? '#ef4444' : '#eab308',
                    backgroundImage: !isLive ? stripedTexture : undefined,
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#9ca3af', fontWeight: 600 }}>
          <span>{isUnknown ? 'Unknown' : `${toGB(totalRequiredBytes)} GB`} Req</span>
          <span>{toGB(ceilingBytes)} GB {isUnified ? 'Unified' : 'VRAM'} Ceiling</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="memory-pipeline-widget"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: 'var(--zen-surface-hover)',
        border: '1px solid var(--zen-border)',
        borderRadius: '12px',
        padding: '14px',
        fontFamily: 'inherit',
      }}
    >
      {/* Header with Stage & Architecture Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--zen-text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Layers style={{ width: '14px', height: '14px', color: 'var(--zen-accent)' }} />
            Memory Pipeline (128k Q8)
          </span>
          <span
            data-testid="memory-phase-badge"
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '999px',
              letterSpacing: '0.4px',
              backgroundColor: isLive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              color: isLive ? 'var(--zen-success)' : 'var(--zen-accent)',
              border: `1px solid ${isLive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isLive ? (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--zen-success)', display: 'inline-block' }} />
                LIVE RUNTIME
              </>
            ) : (
              <>
                <Sparkles style={{ width: '9px', height: '9px' }} />
                PRE-FLIGHT ESTIMATION
              </>
            )}
          </span>
        </div>

        {/* Architecture Pill */}
        <div
          data-testid="architecture-badge"
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '6px',
            backgroundColor: '#1f2937',
            color: '#cbd5e1',
            border: '1px solid #374151',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isUnified ? (
            <>
              <HardDrive style={{ width: '10px', height: '10px', color: '#60a5fa' }} />
              Apple Silicon (Unified Memory)
            </>
          ) : (
            <>
              <Zap style={{ width: '10px', height: '10px', color: '#f59e0b' }} />
              Discrete GPU (Dedicated VRAM)
            </>
          )}
        </div>
      </div>

      {/* Stacked Bar Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          data-testid="memory-stacked-bar"
          style={{
            display: 'flex',
            width: '100%',
            height: '18px',
            backgroundColor: '#111827',
            borderRadius: '6px',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
            border: '1px solid #374151',
          }}
        >
          {isUnknown ? (
            <div
              data-testid="segment-unknown"
              title="Unknown Model Footprint"
              style={{
                width: '100%',
                backgroundColor: '#4b5563',
                backgroundImage: stripedTexture,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontSize: '0.6rem',
                fontWeight: 800,
              }}
            >
              UNKNOWN FOOTPRINT
            </div>
          ) : (
            <>
              {/* Blue: Model Weights */}
              <div
                data-testid="segment-weights"
                title={`Model Weights: ${toGB(weightsBytes)} GB`}
                style={{
                  width: `${weightsPct}%`,
                  backgroundColor: '#3b82f6',
                  backgroundImage: !isLive ? stripedTexture : undefined,
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                }}
              >
                {weightsPct > 12 && `${toGB(weightsBytes)}G`}
              </div>

              {/* Purple: 128k Q8 Context Window */}
              <div
                data-testid="segment-context"
                title={`128k Q8 Context: ${toGB(contextBytes)} GB`}
                style={{
                  width: `${contextPct}%`,
                  backgroundColor: '#a855f7',
                  backgroundImage: !isLive ? stripedTexture : undefined,
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                }}
              >
                {contextPct > 12 && `${toGB(contextBytes)}G`}
              </div>

              {/* Gray: Overhead */}
              <div
                data-testid="segment-overhead"
                title={`Graph Overhead: ${toGB(overheadBytes)} GB`}
                style={{
                  width: `${overheadPct}%`,
                  backgroundColor: '#6b7280',
                  backgroundImage: !isLive ? stripedTexture : undefined,
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '0.55rem',
                  fontWeight: 700,
                }}
              >
                {overheadPct > 8 && `~0.5G`}
              </div>

              {/* Spillover Segment */}
              {spilloverBytes > 0 && (
                <div
                  data-testid="segment-spillover"
                  title={`${spilloverType === 'ssd_swap' ? 'SSD Swap Spillover' : 'System RAM Spillover'}: ${toGB(spilloverBytes)} GB`}
                  style={{
                    width: `${spilloverPct}%`,
                    backgroundColor: spilloverType === 'ssd_swap' ? '#ef4444' : '#eab308',
                    backgroundImage: !isLive ? stripedTexture : undefined,
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.6rem',
                    fontWeight: 800,
                  }}
                >
                  {spilloverPct > 10 && `+${toGB(spilloverBytes)}G`}
                </div>
              )}
            </>
          )}
        </div>

        {/* Ceiling and Total Indicators */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 700, color: 'var(--zen-text-secondary)' }}>
          <span data-testid="total-required-stat">Total Required: <strong style={{ color: 'var(--zen-text)' }}>{isUnknown ? 'Unknown' : `${toGB(totalRequiredBytes)} GB`}</strong></span>
          <span data-testid="hardware-ceiling-stat">Hardware Ceiling: <strong style={{ color: 'var(--zen-text)' }}>{toGB(ceilingBytes)} GB</strong> ({isUnified ? 'Unified' : 'VRAM'})</span>
        </div>
      </div>

      {/* Segment Legend */}
      {!isUnknown && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '0.68rem', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#3b82f6', display: 'inline-block' }} />
            <span style={{ color: '#9ca3af' }}>Weights:</span>
            <span style={{ color: 'var(--zen-text)', fontWeight: 700 }}>{toGB(weightsBytes)} GB</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#a855f7', display: 'inline-block' }} />
            <span style={{ color: '#9ca3af' }}>128k Q8 Context:</span>
            <span style={{ color: 'var(--zen-text)', fontWeight: 700 }}>{toGB(contextBytes)} GB</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#6b7280', display: 'inline-block' }} />
            <span style={{ color: '#9ca3af' }}>Overhead:</span>
            <span style={{ color: 'var(--zen-text)', fontWeight: 700 }}>{toGB(overheadBytes)} GB</span>
          </div>
          {spilloverBytes > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: spilloverType === 'ssd_swap' ? '#ef4444' : '#eab308', display: 'inline-block' }} />
              <span style={{ color: spilloverType === 'ssd_swap' ? '#f87171' : '#facc15' }}>
                {spilloverType === 'ssd_swap' ? 'SSD Swap:' : 'PCIe Spillover:'}
              </span>
              <span style={{ color: spilloverType === 'ssd_swap' ? '#f87171' : '#facc15', fontWeight: 800 }}>+{toGB(spilloverBytes)} GB</span>
            </div>
          )}
        </div>
      )}

      {/* Spillover Warnings */}
      {triggersWarning && (
        <div
          data-testid="spillover-warning-banner"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: spilloverType === 'ssd_swap' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(234, 179, 8, 0.12)',
            border: `1px solid ${spilloverType === 'ssd_swap' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
            color: spilloverType === 'ssd_swap' ? '#f87171' : '#facc15',
            fontSize: '0.7rem',
            lineHeight: '1.3',
          }}
        >
          {spilloverType === 'ssd_swap' ? (
            <AlertOctagon style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }} />
          )}
          <div>
            <strong>{spilloverType === 'ssd_swap' ? 'Severe SSD Swap Warning: ' : 'PCIe Bus Bottleneck Warning: '}</strong>
            {warningMessage ? (
              warningMessage.replace(/^(PCIe (Bus )?Bottleneck Warning: |Critical SSD Swap Warning: |Severe SSD Swap Warning: )/i, '')
            ) : (
              spilloverType === 'ssd_swap'
                ? 'Model context exceeds available unified memory. Paging to disk will cause drastic latency spikes.'
                : '128k context exceeds Dedicated VRAM and will overflow across PCIe to System RAM, reducing generation speed.'
            )}
          </div>
        </div>
      )}
    </div>
  );
};
