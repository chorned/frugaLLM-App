import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { listen } from '@tauri-apps/api/event';

const InfoIconSVG = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="-50 -50 590 590" fill="currentColor" {...props}>
    <path d="M245.148,0C109.967,0,0.009,109.98,0.009,245.162c0,135.182,109.958,245.156,245.139,245.156 c135.186,0,245.162-109.978,245.162-245.156C490.31,109.98,380.333,0,245.148,0z M245.148,438.415 c-106.555,0-193.234-86.698-193.234-193.253c0-106.555,86.68-193.258,193.234-193.258c106.559,0,193.258,86.703,193.258,193.258 C438.406,351.717,351.706,438.415,245.148,438.415z"/>
    <path d="M270.036,221.352h-49.771c-8.351,0-15.131,6.78-15.131,15.118v147.566c0,8.352,6.78,15.119,15.131,15.119h49.771 c8.351,0,15.131-6.77,15.131-15.119V236.471C285.167,228.133,278.387,221.352,270.036,221.352z"/>
    <path d="M245.148,91.168c-24.48,0-44.336,19.855-44.336,44.336c0,24.484,19.855,44.34,44.336,44.34 c24.485,0,44.342-19.855,44.342-44.34C289.489,111.023,269.634,91.168,245.148,91.168z"/>
  </svg>
);

export interface ProcessStatus {
  status: 'offline' | 'starting' | 'active' | 'error';
  pid?: number;
  cpu?: number;
  ram?: number;
  uptime?: number;
}

// =============================================================================
// StatusLight — Pulsing indicator wired to service health
// =============================================================================
export type NodeStatus = 'not_installed' | 'error' | 'ready' | 'active' | 'standby' | 'inactive';

export const StatusLight = ({ status, text }: { status: NodeStatus; text?: string }) => {
  let color = 'var(--zen-text-secondary)';
  let label = text || status.toUpperCase();
  let animate = false;

  switch (status) {
    case 'not_installed':
      color = '#ef4444'; // Red
      label = text || 'NOT INSTALLED';
      break;
    case 'error':
      color = '#f97316'; // Orange
      label = text || 'ERROR';
      break;
    case 'ready':
    case 'standby':
      color = '#eab308'; // Yellow
      label = text || 'READY';
      break;
    case 'active':
      color = 'var(--zen-success)'; // Green
      label = text || 'ACTIVE';
      animate = true;
      break;
    case 'inactive':
    default:
      color = 'var(--zen-text-secondary)';
      label = text || 'INACTIVE';
      break;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', display: 'flex', width: '10px', height: '10px' }}>
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
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      </div>
      <span
        style={{
          fontSize: '0.75rem',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
      <span
        style={{
          fontSize: '0.6rem',
          fontWeight: 800,
          color: '#6b7280',
          }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--zen-surface)',
          border: '1px solid var(--zen-border)', borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <input
          type={type}
          readOnly
          value={value}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--zen-text)',
            padding: '6px 10px',
            fontSize: '0.75rem',
            fontWeight: 400,
            fontFamily: 'inherit',
            outline: 'none',
            border: 'none',
            width: '100%',
            cursor: 'default',
          }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          style={{
            backgroundColor: copied ? 'var(--zen-success)' : 'var(--zen-surface-hover)',
            color: copied ? 'white' : 'var(--zen-text-secondary)',
            padding: '6px 12px',
            fontSize: '0.6rem',
            fontWeight: 500,
            fontFamily: 'inherit',
            border: 'none',
            borderLeft: '1px solid var(--zen-border)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'var(--zen-border)';
              e.currentTarget.style.color = 'var(--zen-text)';
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)';
              e.currentTarget.style.color = 'var(--zen-text-secondary)';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
      <span
        style={{
          fontSize: '0.6rem',
          fontWeight: 800,
          color: '#6b7280',
          }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--zen-surface)',
          border: '1px solid var(--zen-border)', borderRadius: '8px',
          overflow: 'hidden',
          padding: '6px 10px',
        }}
      >
        <span
          style={{
            color: 'var(--zen-text)',
            fontSize: '0.75rem',
            fontWeight: 400,
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
export const HardwareNode = ({ isGenerating = false }: { isGenerating?: boolean }) => {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      unlisten = await listen<any>('telemetry_update', (event) => {
        setTelemetry(event.payload);
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

  const isCpuMode = !telemetry || telemetry.ollama.location_state === 'cpu' || telemetry.hardware.vram_total === 0;
  const memUsedRaw = isCpuMode ? (telemetry?.ollama?.total_size || 0) : (telemetry?.hardware?.vram_used || 0);
  const memTotalRaw = isCpuMode ? (16 * 1024 * 1024 * 1024) : (telemetry?.hardware?.vram_total || 0);

  const memUsed = telemetry ? (memUsedRaw / 1024 / 1024 / 1024).toFixed(1) : '0.0';
  const memTotal = telemetry ? (memTotalRaw / 1024 / 1024 / 1024).toFixed(1) : '0.0';
  const memPercent = telemetry && memTotalRaw > 0 ? (memUsedRaw / memTotalRaw) * 100 : 0;
    
  const isActive = telemetry?.ollama?.status === 'active';

  const [throughput, setThroughput] = useState(0);
  useEffect(() => {
    if (!isActive) { setThroughput(0); return; }
    let totalChars = 0; let startTime: number | null = null; let timeout: ReturnType<typeof setTimeout>;
    const handleBytes = (e: any) => {
      const now = performance.now();
      if (!startTime) startTime = now;
      totalChars += e.detail;
      const elapsedSec = (now - startTime) / 1000;
      if (elapsedSec > 0.5) setThroughput((totalChars / elapsedSec) / 4);
      clearTimeout(timeout);
      timeout = setTimeout(() => { setThroughput(0); totalChars = 0; startTime = null; }, 1000);
    };
    window.addEventListener('pty_bytes', handleBytes);
    return () => { window.removeEventListener('pty_bytes', handleBytes); clearTimeout(timeout); };
  }, [isActive]);

  const isLoaded = telemetry?.ollama?.status === 'active';
  const isThinking = (isGenerating && isLoaded) || throughput > 0;
  const isLoading = isGenerating && !isLoaded;

  let headerStatusText = 'Standby';
  if (isLoading) headerStatusText = 'Loading';
  else if (isThinking) headerStatusText = 'Thinking';
  else if (isLoaded) headerStatusText = 'Loaded';
  const isStatusActive = isLoading || isThinking || isLoaded;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Header */}
        <div 
          onClick={(e) => { e.stopPropagation(); setShowPanel(true); }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--zen-border)', padding: '8px 12px', backgroundColor: 'var(--zen-surface)' }}
        >
          <div id="local-hardware-heading" style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--zen-text)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            Local Hardware
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StatusLight status={isStatusActive ? 'active' : 'standby'} text={headerStatusText} />
            <div 
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--zen-accent)', transition: 'opacity 0.2s', opacity: 0.8
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
            >
              <InfoIconSVG width="14" height="14" style={{ display: 'block' }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--zen-surface)', color: 'var(--zen-text)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>Active Model</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isLoaded ? 'var(--zen-text)' : 'var(--zen-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }} title={isLoaded ? telemetry?.ollama?.model_name : 'None'}>
              {isLoaded ? telemetry?.ollama?.model_name : 'None'}
            </span>
          </div>
        </div>
      </div>

      {showPanel && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(249,249,248,0.5)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'default' }} 
          onClick={(e) => { e.stopPropagation(); setShowPanel(false); }}
        >
          <div 
            data-testid="hardware-telemetry-panel"
            style={{ width: '350px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--zen-border)', paddingBottom: '8px' }}>
              <span style={{ fontWeight: 800, color: 'var(--zen-text)', fontSize: '1rem' }}>Hardware Telemetry</span>
              <span onClick={() => setShowPanel(false)} style={{ color: '#9ca3af', cursor: 'pointer', fontWeight: 'bold' }}>✕</span>
            </div>
            
            {/* Utilization Bar (Load) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>
                <span>{isCpuMode ? 'CPU Load' : 'GPU Load'}</span>
                <span>{loadPercent.toFixed(1)}%</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '5px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: 'var(--zen-accent)', 
                    transition: 'width 0.3s ease-out', 
                    width: `${Math.min(100, Math.max(0, loadPercent))}%` 
                  }} 
                />
              </div>
            </div>

            {/* Utilization Bar (Memory) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>
                <span>{isCpuMode ? 'RAM Allocation' : 'VRAM Allocation'}</span>
                <span>{memUsed} / {memTotal} GB</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '5px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: 'var(--zen-accent)', 
                    transition: 'width 0.3s ease-out', 
                    width: `${memPercent}%` 
                  }} 
                />
              </div>
            </div>

            {/* Throughput Metric */}
            <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--zen-text-secondary)' }}>Throughput</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isActive ? 'var(--zen-text)' : 'var(--zen-text-secondary)' }}>
                {throughput.toFixed(1)} <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>t/s</span>
              </span>
            </div>
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
}
export const CloudConnectNode = ({ isActive = false, label = 'External Cloud', targetHost = 'None' }: CloudConnectNodeProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--zen-border)', padding: '8px 12px', backgroundColor: 'var(--zen-surface)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--zen-text)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {label.toUpperCase()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div 
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--zen-accent)',
              transition: 'opacity 0.2s',
              opacity: 0.8
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            <InfoIconSVG width="14" height="14" style={{ display: 'block' }} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--zen-surface)', color: 'var(--zen-text)' }}>
        {/* Connection Target Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>Current Target</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isActive ? 'var(--zen-text)' : 'var(--zen-text-secondary)' }}>
            {isActive ? targetHost : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
};
