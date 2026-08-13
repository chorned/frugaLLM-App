import { useState, useEffect } from 'react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { listen } from '@tauri-apps/api/event';


interface TelemetryPayload {
  ollama: {
    status: string;
    model_name: string;
    location_state: string;
    hybrid_percent: number;
    total_size: number;
    vram_size: number;
  };
  hardware: {
    cpu_utilization: number;
    gpu_utilization: number;
    vram_used: number;
    vram_total: number;
  };
}

// =============================================================================
// StatusLight — Pulsing indicator wired to service health
// =============================================================================
export const StatusLight = ({ active, text }: { active: boolean; text: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{ position: 'relative', display: 'flex', width: '10px', height: '10px' }}>
      {active && (
        <span
          className="animate-ping"
          style={{
            position: 'absolute',
            display: 'inline-flex',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#34d399',
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
          backgroundColor: active ? '#10b981' : '#9ca3af',
          boxShadow: active ? '0 0 6px #10b981' : 'none',
        }}
      />
    </div>
    <span
      style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        color: active ? '#10b981' : '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {text}
    </span>
  </div>
);

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
          textTransform: 'uppercase',
          color: '#6b7280',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          backgroundColor: '#111827',
          border: '1.5px solid #374151',
          overflow: 'hidden',
        }}
      >
        <input
          type={type}
          readOnly
          value={value}
          style={{
            backgroundColor: 'transparent',
            color: '#22d3ee',
            padding: '4px 8px',
            fontSize: '0.7rem',
            fontWeight: 600,
            fontFamily: '"Courier New", Courier, monospace',
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
            backgroundColor: copied ? '#065f46' : '#1f2937',
            color: copied ? '#34d399' : '#9ca3af',
            padding: '4px 10px',
            fontSize: '0.6rem',
            fontWeight: 700,
            fontFamily: '"Courier New", Courier, monospace',
            border: 'none',
            borderLeft: '1.5px solid #374151',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = '#374151';
              e.currentTarget.style.color = '#ffffff';
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = '#1f2937';
              e.currentTarget.style.color = '#9ca3af';
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
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#4b5563',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
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
        border: `2px solid ${checked ? '#10b981' : '#4b5563'}`,
        backgroundColor: checked ? '#065f46' : '#1f2937',
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
          backgroundColor: checked ? '#10b981' : '#6b7280',
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          transition: 'all 0.2s',
          boxShadow: checked ? '0 0 4px #10b981' : 'none',
        }}
      />
    </button>
  </div>
);

// =============================================================================
// HardwareNode — Infrastructure node for local GPU/CPU telemetry
// =============================================================================
export const HardwareNode = ({ isGenerating = false }: { isGenerating?: boolean }) => {
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    console.log("HardwareNode isGenerating:", isGenerating);
  }, [isGenerating]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      unlisten = await listen<TelemetryPayload>('telemetry_update', (event) => {
        setTelemetry(event.payload);
      });
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const loadPercent = telemetry
    ? telemetry.ollama.location_state === 'cpu'
      ? telemetry.hardware.cpu_utilization
      : (telemetry.hardware.gpu_utilization || telemetry.hardware.cpu_utilization) // fallback to CPU if GPU util is 0
    : 0;

  const isCpuMode = !telemetry || telemetry.ollama.location_state === 'cpu' || telemetry.hardware.vram_total === 0;
  
  // On Intel Macs or CPU mode, Ollama uses system RAM, not VRAM. We use the model's total_size from Ollama telemetry as an approximation of RAM used.
  const memUsedRaw = isCpuMode ? (telemetry?.ollama?.total_size || 0) : (telemetry?.hardware?.vram_used || 0);
  const memTotalRaw = isCpuMode ? (16 * 1024 * 1024 * 1024) : (telemetry?.hardware?.vram_total || 0); // Assume 16GB for System RAM fallback

  const memUsed = telemetry ? (memUsedRaw / 1024 / 1024 / 1024).toFixed(1) : '0.0';
  const memTotal = telemetry ? (memTotalRaw / 1024 / 1024 / 1024).toFixed(1) : '0.0';
  const memPercent = telemetry && memTotalRaw > 0
    ? (memUsedRaw / memTotalRaw) * 100
    : 0;
    
  const isActive = telemetry?.ollama?.status === 'active';

  // Throughput calculation: We listen to the raw PTY stream output from the terminal
  // and measure the bytes-per-second to approximate real token generation (avg 4 chars/token).
  const [throughput, setThroughput] = useState(0);
  useEffect(() => {
    if (!isActive) {
      setThroughput(0);
      return;
    }
    
    let totalChars = 0;
    let startTime: number | null = null;
    let timeout: ReturnType<typeof setTimeout>;

    const handleBytes = (e: any) => {
      const now = performance.now();
      
      // Initialize start time on the first chunk of a new stream
      if (!startTime) {
        startTime = now;
      }
      
      totalChars += e.detail;
      const elapsedSec = (now - startTime) / 1000;
      
      // Wait 500ms before displaying to avoid initial infinity spikes, 
      // then calculate average over the total generation time for stability.
      if (elapsedSec > 0.5) {
        const charsPerSec = totalChars / elapsedSec;
        setThroughput(charsPerSec / 4);
      }
      
      // If the stream pauses for 1 second (e.g. generation finished or user is just typing),
      // reset the state so the next prompt calculates cleanly.
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setThroughput(0);
        totalChars = 0;
        startTime = null;
      }, 1000);
    };

    window.addEventListener('pty_bytes', handleBytes);
    return () => {
      window.removeEventListener('pty_bytes', handleBytes);
      clearTimeout(timeout);
    };
  }, [isActive]);

  const isLoaded = telemetry?.ollama?.status === 'active';
  const isThinking = (isGenerating && isLoaded) || throughput > 0;
  const isLoading = isGenerating && !isLoaded;

  let headerStatusText = 'IDLE';
  if (isLoading) headerStatusText = 'LOADING';
  else if (isThinking) headerStatusText = 'THINKING';
  else if (isLoaded) headerStatusText = 'LOADED';

  const isStatusActive = isLoading || isThinking || isLoaded;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', padding: '4px' }}>
      {/* Header */}
      <div 
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #374151', paddingBottom: '8px', cursor: 'pointer' }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#e5e7eb', display: 'flex', gap: '8px', alignItems: 'center' }}>
          LOCAL HARDWARE
          <span style={{ fontSize: '0.6rem', color: '#9ca3af' }}>{isCollapsed ? '▼' : '▲'}</span>
          {/* Debug indicator to help diagnose state issues */}

        </div>
        <StatusLight active={isStatusActive} text={headerStatusText} />
      </div>

      {/* Model Name Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af' }}>Active Model</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isLoaded ? '#e5e7eb' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }} title={isLoaded ? telemetry?.ollama?.model_name : 'None'}>
          {isLoaded ? telemetry?.ollama?.model_name : 'None'}
        </span>
      </div>

      {!isCollapsed && (
        <>
          {/* Utilization Bar (Load) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af' }}>
              <span>{isCpuMode ? 'CPU Load' : 'GPU Load'}</span>
              <span>{loadPercent.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#1f2937', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  backgroundColor: isCpuMode ? '#3b82f6' : '#ea580c', 
                  transition: 'width 0.3s ease-out', 
                  width: `${Math.min(100, Math.max(0, loadPercent))}%` 
                }} 
              />
            </div>
          </div>

          {/* Utilization Bar (Memory) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af' }}>
              <span>{isCpuMode ? 'RAM Allocation' : 'VRAM Allocation'}</span>
              <span>{memUsed} / {memTotal} GB</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#1f2937', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  backgroundColor: '#8b5cf6', 
                  transition: 'width 0.3s ease-out', 
                  width: `${Math.min(100, Math.max(0, memPercent))}%` 
                }} 
              />
            </div>
          </div>

          {/* Throughput Metric */}
          <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Throughput</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isActive ? '#10b981' : '#6b7280' }}>
              {throughput.toFixed(1)} <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>t/s</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// =============================================================================
// CloudConnectNode — Abstract infrastructure node for external network routing
// =============================================================================
export const CloudConnectNode = ({ isActive = false }: { isActive?: boolean }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', padding: '4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#e5e7eb', display: 'flex', gap: '8px', alignItems: 'center' }}>
          EXTERNAL CLOUD

        </div>
        <StatusLight active={isActive} text={isActive ? 'ROUTING' : 'IDLE'} />
      </div>

      {/* Connection Target Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af' }}>Gateway</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e5e7eb' }}>
          OpenRouter API
        </span>
      </div>
    </div>
  );
};
