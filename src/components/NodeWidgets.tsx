import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { listen } from '@tauri-apps/api/event';
import en from '../locales/en.json';
import { MemoryPipelineWidget } from './MemoryPipelineWidget';
import { useMemory } from '../context/MemoryContext';
import { OllamaIcon } from './icons/ProviderIcons';

let isScreenshotMode = () => false;
let APPSTORE_TELEMETRY: any = null;

if (import.meta.env.DEV) {
  const mod = await import('../dev/screenshotMode');
  isScreenshotMode = mod.isScreenshotMode;
  APPSTORE_TELEMETRY = mod.APPSTORE_TELEMETRY;
}

const InfoIconSVG = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="-50 -50 590 590" fill="currentColor" {...props}>
    <path d="M245.148,0C109.967,0,0.009,109.98,0.009,245.162c0,135.182,109.958,245.156,245.139,245.156 c135.186,0,245.162-109.978,245.162-245.156C490.31,109.98,380.333,0,245.148,0z M245.148,438.415 c-106.555,0-193.234-86.698-193.234-193.253c0-106.555,86.68-193.258,193.234-193.258c106.559,0,193.258,86.703,193.258,193.258 C438.406,351.717,351.706,438.415,245.148,438.415z"/>
    <path d="M270.036,221.352h-49.771c-8.351,0-15.131,6.78-15.131,15.118v147.566c0,8.352,6.78,15.119,15.131,15.119h49.771 c8.351,0,15.131-6.77,15.131-15.119V236.471C285.167,228.133,278.387,221.352,270.036,221.352z"/>
    <path d="M245.148,91.168c-24.48,0-44.336,19.855-44.336,44.336c0,24.484,19.855,44.34,44.336,44.34 c24.485,0,44.342-19.855,44.342-44.34C289.489,111.023,269.634,91.168,245.148,91.168z"/>
  </svg>
);


// =============================================================================
// StatusLight — Pulsing indicator wired to service health
// =============================================================================
export type NodeStatus = 'not_installed' | 'error' | 'ready' | 'active' | 'standby' | 'inactive';

export const StatusLight = ({ status, text, color: customColor }: { status: NodeStatus; text?: string; color?: string }) => {
  let color = customColor || 'var(--zen-text-secondary)';
  let label = text || status.toUpperCase();
  let animate = false;

  if (!customColor) {
    switch (status) {
      case 'not_installed':
        color = '#ef4444'; // Red
        label = text || 'NOT INSTALLED';
        break;
      case 'error':
        color = '#ef4444'; // Red (Hard error)
        label = text || 'ERROR';
        break;
      case 'ready':
      case 'standby':
        color = '#eab308'; // Yellow
        label = text || 'READY';
        break;
      case 'active':
        color = '#10B981'; // Emerald Green
        label = text || 'ACTIVE';
        animate = true;
        break;
      case 'inactive':
      default:
        color = 'var(--zen-text-secondary)';
        label = text || 'INACTIVE';
        break;
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
        {animate && (
          <span
            className="animate-ping"
            style={{
              position: 'absolute',
              display: 'inline-flex',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.75,
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      </div>
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 500,
          color: color,
        }}
      >
        {label}
      </span>
    </div>
  );
};

// =============================================================================
// CopyableField — Read-only input with native Tauri clipboard copy
// =============================================================================
export const CopyableField = ({
  label,
  value,
  type = 'text',
}: {
  label: string;
  value: string;
  type?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: 'var(--zen-text-secondary)',
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--zen-surface-hover)',
          border: '1px solid var(--zen-border-input)', 
          borderRadius: '12px',
          overflow: 'hidden',
          padding: '2px 4px 2px 8px',
          alignItems: 'center'
        }}
      >
        <input
          type={type}
          readOnly
          value={value}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--zen-text)',
            padding: '6px 4px',
            fontSize: '0.78rem',
            fontWeight: 450,
            fontFamily: 'inherit',
            outline: 'none',
            border: 'none',
            width: '100%',
            cursor: 'default',
          }}
        />
        <button
          className="btn-cta btn-cta-secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          style={{
            backgroundColor: copied ? '#10B981' : 'var(--zen-surface)',
            color: copied ? '#FFFFFF' : 'var(--zen-text)',
            padding: '4px 10px',
            fontSize: '0.65rem',
            fontWeight: 600,
            fontFamily: 'inherit',
            border: 'none',
            borderRadius: '9999px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'var(--zen-surface)';
            }
          }}
        >
          {copied ? '✓ OK' : 'COPY'}
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// InfoField — Read-only info text without copy button
// =============================================================================
export const InfoField = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: 'var(--zen-text-secondary)',
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--zen-surface-hover)',
          border: '1px solid var(--zen-border-input)', 
          borderRadius: '12px',
          overflow: 'hidden',
          padding: '8px 12px',
        }}
      >
        <span
          style={{
            color: 'var(--zen-text)',
            fontSize: '0.78rem',
            fontWeight: 450,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
};


// =============================================================================
// SettingsToggle — Boolean toggle for Tauri IPC settings
// =============================================================================
export const SettingsToggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }}
  >
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 500,
        color: 'var(--zen-text)',
        }}
    >
      {label}
    </span>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{
        width: '36px',
        height: '18px',
        borderRadius: '9px',
        border: 'none',
        backgroundColor: checked ? 'var(--zen-success)' : 'var(--zen-border)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s',
        padding: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'white',
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
    </button>
  </div>
);

// =============================================================================
// HardwareNode — Infrastructure node for local GPU/CPU telemetry
// =============================================================================
export const HardwareNode = ({ 
  isGenerating = false,
  label = en.routingGraph.nodes.ollamaLocal.label || 'Ollama',
  subheader = (en.routingGraph.nodes.ollamaLocal as any).subheader || 'Open source',
  icon,
  isSelected = false,
  lastStatus
}: { 
  isGenerating?: boolean;
  label?: string;
  subheader?: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  lastStatus?: string;
}) => {
  const memory = useMemory();
  const memoryRef = useRef(memory);
  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  const [telemetry, setTelemetry] = useState<any>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return APPSTORE_TELEMETRY;
    return null;
  });
  const [showPanel, setShowPanel] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  const [avgThroughput, setAvgThroughput] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('frugallm_avg_throughput');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [liveThroughput, setLiveThroughput] = useState(0);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      unlisten = await listen<any>('telemetry_update', (event) => {
        setTelemetry(event.payload);
        if (event.payload) {
          memoryRef.current.setLatestTelemetry(event.payload);
          if (event.payload.hardware_profile) {
            memoryRef.current.setHardwareProfile(event.payload.hardware_profile);
          }
        }
      });
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const loadPercent = telemetry && telemetry.hardware
    ? telemetry.ollama.location_state === 'cpu' || telemetry.hardware.vram_total === 0
      ? telemetry.hardware.cpu_utilization
      : (telemetry.hardware.gpu_utilization || telemetry.hardware.cpu_utilization)
    : 0;

  const effectiveProfile = memory.hardwareProfile || telemetry?.hardware_profile;
  const isUnified = effectiveProfile?.is_unified ?? false;
  const executionCeiling =
    effectiveProfile?.execution_ceiling ||
    memory.effectiveSegments?.execution_ceiling_bytes ||
    (telemetry?.hardware?.vram_total || 0) ||
    (8 * 1024 * 1024 * 1024);
  const isCpuMode = !telemetry || telemetry.ollama?.location_state === 'cpu' || (!isUnified && (telemetry.hardware?.vram_total || 0) === 0);
  const memUsedRaw = isCpuMode ? (telemetry?.ollama?.total_size || 0) : (telemetry?.hardware?.vram_used || telemetry?.ollama?.total_size || 0);
  const memTotalRaw = executionCeiling;

  const memUsed = telemetry && memUsedRaw > 0 ? (memUsedRaw / 1024 / 1024 / 1024).toFixed(1) : '0.0';
  const memTotal = (memTotalRaw / 1024 / 1024 / 1024).toFixed(1);
  const memPercent = telemetry && memTotalRaw > 0 ? (memUsedRaw / memTotalRaw) * 100 : 0;
    
  const isActive = telemetry?.ollama?.status === 'active';

  // Cold-Start and Hot-Start aware token throughput measurement:
  // - Cold Start: Discards pre-generation prompt evaluation & TTFT latency. Timing begins on the first token chunk.
  // - Hot Start: Steady-state generation across active token stream with spike filtering and run persistence.
  useEffect(() => {
    if (!isActive) {
      setLiveThroughput(0);
      return;
    }

    let totalChars = 0;
    let firstTokenTime: number | null = null;
    let runTokens = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const handleBytes = (e: any) => {
      const now = performance.now();
      const chunkBytes = Number(e.detail) || 0;
      if (chunkBytes <= 0) return;

      // Cold Start -> Hot Start transition on first token arrival
      if (!firstTokenTime) {
        firstTokenTime = now;
        totalChars = chunkBytes;
        runTokens = chunkBytes / 4.0;
      } else {
        totalChars += chunkBytes;
        runTokens += chunkBytes / 4.0;

        const totalElapsedSec = (now - firstTokenTime) / 1000;
        // Require at least 300ms of hot generation to eliminate instant buffer flush artifacts
        if (totalElapsedSec >= 0.3) {
          const rawAvgTps = runTokens / totalElapsedSec;
          // Compute physical generation speed without artificial upper clamp
          const smoothedAvg = Math.max(rawAvgTps, 0.0);
          const rounded = Math.round(smoothedAvg * 10) / 10;
          setLiveThroughput(rounded);
          setAvgThroughput(rounded);

          try {
            localStorage.setItem('frugallm_avg_throughput', rounded.toString());
          } catch {
            // Storage quota ignored
          }
        }
      }

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        // Stream completed: zero live throughput while preserving hot run average
        setLiveThroughput(0);
        totalChars = 0;
        firstTokenTime = null;
        runTokens = 0;
      }, 1200);
    };

    window.addEventListener('pty_bytes', handleBytes);
    return () => {
      window.removeEventListener('pty_bytes', handleBytes);
      clearTimeout(timeout);
    };
  }, [isActive]);

  const isLoaded = telemetry?.ollama?.status === 'active';
  const isThinking = (isGenerating && isLoaded) || liveThroughput > 0;
  const isLoading = isGenerating && !isLoaded;
  const isTemporaryExhausted = !!lastStatus && (/429/i.test(lastStatus) || /5\d\d/i.test(lastStatus) || /timeout/i.test(lastStatus));
  const isDead = !!lastStatus && (/403|404|401/i.test(lastStatus) || /offline/i.test(lastStatus) || (!isTemporaryExhausted && /4\d\d/i.test(lastStatus)));
  const isError = isTemporaryExhausted || isDead;
  const statusLightColor = isDead ? '#ef4444' : isTemporaryExhausted ? '#eab308' : undefined;

  let headerStatusText = 'Standby';
  if (isError) headerStatusText = lastStatus!;
  else if (isLoading) headerStatusText = 'Loading';
  else if (isThinking) headerStatusText = 'Thinking';
  else if (isLoaded) headerStatusText = 'Loaded';
  const isStatusActive = isError || isLoading || isThinking || isLoaded;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none', padding: '10px 14px', backgroundColor: isSelected ? 'var(--zen-surface-header-active)' : 'var(--zen-surface-header)' }}
        >
          <div id="local-hardware-heading" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {icon ?? <OllamaIcon size={18} />}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--zen-text)', letterSpacing: '0.02em' }}>
                {label}
              </span>
              {subheader && (
                <span style={{ fontWeight: 450, fontSize: '0.65rem', color: 'var(--zen-text-secondary)' }}>
                  {subheader}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isStatusActive && (
              <span data-testid="node-ollama-status">
                <StatusLight status={isError ? (isDead ? 'not_installed' : 'standby') : 'active'} text={headerStatusText} color={statusLightColor} />
              </span>
            )}
            <div 
              data-testid="hardware-info-btn"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowPanel(prev => !prev);
              }}
              title="View Hardware Telemetry"
              style={{
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--zen-text)',
                padding: '4px', borderRadius: '9999px',
                opacity: 0.8
              }}
            >
              <InfoIconSVG width="14" height="14" style={{ display: 'block' }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--zen-surface)', color: 'var(--zen-text)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Active Model</span>
            {(() => {
              const rawName = isLoaded ? (telemetry?.ollama?.model_name || memory.activeModelName) : 'None';
              const displayName = rawName.replace(/^library\//, '').replace(/frugallm-active.*/, 'gemma4').replace(/:latest$/, '');
              return (
                <span data-testid="active-model-name" style={{ fontSize: '0.78rem', fontWeight: 600, color: isLoaded ? 'var(--zen-text)' : 'var(--zen-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }} title={isLoaded ? displayName : 'None'}>
                  {isLoaded ? displayName : 'None'}
                </span>
              );
            })()}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Allocation</span>
            <span data-testid="hardware-node-allocation" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--zen-text-secondary)' }}>
              {memUsed} / {memTotal} GB
            </span>
          </div>
        </div>
      </div>

      {showPanel && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'default' }} 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setShowPanel(false); }}
        >
          <div 
            data-testid="hardware-telemetry-panel"
            style={{ width: '440px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--zen-shadow-modal)', maxHeight: '90vh', overflowY: 'auto' }} 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'none', paddingBottom: '12px' }}>
              <span style={{ fontWeight: 700, color: 'var(--zen-text)', fontSize: '1rem', letterSpacing: '-0.01em' }}>
                {en.routingGraph.hardwareTelemetryWidget.title}
              </span>
              <button 
                className="btn-cta btn-cta-icon"
                onClick={() => setShowPanel(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--zen-text-secondary)', fontWeight: 'bold', fontSize: '1.1rem', padding: '4px 8px', borderRadius: '9999px' }}
              >
                ✕
              </button>
            </div>

            {/* Average Throughput Metric Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--zen-surface-secondary)', padding: '12px 16px', borderRadius: '14px', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                    {en.routingGraph.hardwareTelemetryWidget.avgThroughput}
                  </span>
                  <div
                    data-testid="benchmark-info-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBenchmarks(prev => !prev);
                    }}
                    title={en.routingGraph.hardwareTelemetryWidget.viewBenchmarks}
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: showBenchmarks ? 'var(--zen-text)' : 'var(--zen-text-secondary)',
                      opacity: showBenchmarks ? 1 : 0.75,
                      transition: 'all 0.15s ease',
                      padding: '2px',
                      borderRadius: '4px'
                    }}
                  >
                    <InfoIconSVG width="13" height="13" />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {liveThroughput > 0 && (
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  )}
                  <span data-testid="live-throughput-stat" style={{ fontSize: '0.95rem', fontWeight: 700, color: (liveThroughput > 0 || avgThroughput > 0) ? 'var(--zen-text)' : 'var(--zen-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {(liveThroughput > 0 ? liveThroughput : avgThroughput).toFixed(1)} <span style={{ fontSize: '0.7rem', color: 'var(--zen-text-secondary)', fontWeight: 500 }}>t/s</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Benchmark Reference Panel */}
            {showBenchmarks && (
              <div 
                data-testid="benchmark-panel"
                style={{
                  backgroundColor: 'var(--zen-surface-secondary)',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--zen-text)', fontSize: '0.78rem' }}>
                    {en.routingGraph.hardwareTelemetryWidget.benchmarkTitle}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--zen-text-secondary)', fontWeight: 500 }}>tokens / sec</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--zen-text-secondary)', lineHeight: 1.4 }}>
                  {en.routingGraph.hardwareTelemetryWidget.benchmarkSubtitle}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'var(--zen-surface)', borderRadius: '10px', border: 'none' }}>
                    <span style={{ fontWeight: 500, color: 'var(--zen-text)', fontSize: '0.75rem' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkSonnet}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--zen-text)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkSonnetSpeed}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'var(--zen-surface)', borderRadius: '10px', border: 'none' }}>
                    <span style={{ fontWeight: 500, color: 'var(--zen-text)', fontSize: '0.75rem' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkGeminiFlash}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--zen-text)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkGeminiFlashSpeed}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'var(--zen-surface)', borderRadius: '10px', border: 'none' }}>
                    <span style={{ fontWeight: 500, color: 'var(--zen-text)', fontSize: '0.75rem' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkHaiku}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--zen-text)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkHaikuSpeed}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'var(--zen-surface)', borderRadius: '10px', border: 'none' }}>
                    <span style={{ fontWeight: 500, color: 'var(--zen-text)', fontSize: '0.75rem' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkLocalGpu}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--zen-text)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkLocalGpuSpeed}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'var(--zen-surface)', borderRadius: '10px', border: 'none' }}>
                    <span style={{ fontWeight: 500, color: 'var(--zen-text)', fontSize: '0.75rem' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkLocalCpu}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--zen-text)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                      {en.routingGraph.hardwareTelemetryWidget.benchmarkLocalCpuSpeed}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Utilization Bar (Memory) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>
                <span data-testid="telemetry-memory-label">{isCpuMode ? en.routingGraph.hardwareTelemetryWidget.ramAllocation : en.routingGraph.hardwareTelemetryWidget.vramAllocation}</span>
                <span data-testid="telemetry-memory-value">{memUsed} / {memTotal} GB</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--zen-pill-bg)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: 'var(--zen-accent)', 
                    borderRadius: '9999px',
                    transition: 'width 0.3s ease-out', 
                    width: `${memPercent}%` 
                  }} 
                />
              </div>
            </div>

            {/* Utilization Bar (Load) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>
                <span data-testid="telemetry-load-label">{isCpuMode ? en.routingGraph.hardwareTelemetryWidget.cpuLoad : en.routingGraph.hardwareTelemetryWidget.gpuLoad}</span>
                <span data-testid="telemetry-load-value">{loadPercent.toFixed(1)}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--zen-pill-bg)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: 'var(--zen-accent)', 
                    borderRadius: '9999px',
                    transition: 'width 0.3s ease-out', 
                    width: `${Math.min(100, Math.max(0, loadPercent))}%` 
                  }} 
                />
              </div>
            </div>

            {/* Memory Pipeline Stacked Bar Visualization */}
            <MemoryPipelineWidget segments={telemetry?.segments} hardwareProfile={effectiveProfile} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// =============================================================================
interface CloudConnectNodeProps {
  isActive?: boolean;
  label?: string;
  targetHost?: string;
  icon?: React.ReactNode;
}
export const CloudConnectNode = ({ isActive = false, label = 'External Cloud', targetHost = 'None', icon }: CloudConnectNodeProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none', padding: '10px 14px', backgroundColor: 'var(--zen-surface)' }}>
        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--zen-text)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {icon}
          {label.toUpperCase()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div 
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--zen-text-secondary)',
              padding: '4px',
              borderRadius: '9999px'
            }}
          >
            <InfoIconSVG width="14" height="14" style={{ display: 'block' }} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--zen-surface)', color: 'var(--zen-text)' }}>
        {/* Connection Target Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Current Target</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: isActive ? 'var(--zen-text)' : 'var(--zen-text-secondary)' }}>
            {isActive ? targetHost : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
};
