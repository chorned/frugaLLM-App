import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Activity, Cpu, Database, Zap, PowerOff, AlertCircle } from 'lucide-react';

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

export function HardwareTelemetryWidget() {
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [history, setHistory] = useState<number[]>(Array(20).fill(0));

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<TelemetryPayload>('telemetry_update', (event) => {
        const data = event.payload;
        setTelemetry(data);
        setHistory(prev => {
          const util = data.ollama.location_state === 'cpu' ? data.hardware.cpu_utilization : data.hardware.gpu_utilization;
          const next = [...prev.slice(1), util];
          return next;
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!telemetry || telemetry.ollama.status === 'offline') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-gray-900 border border-gray-800 rounded-lg w-64 shadow-lg text-gray-500 font-mono text-sm">
        <PowerOff className="w-8 h-8 mb-2 text-gray-700" />
        <span>Ollama Daemon Offline</span>
        <span className="text-xs text-gray-600 mt-1">Waiting for connection...</span>
      </div>
    );
  }

  const { ollama, hardware } = telemetry;
  const isIdle = ollama.status === 'idle' || !ollama.model_name || ollama.model_name === 'Unknown';

  const getLocationBadge = () => {
    switch (ollama.location_state) {
      case 'gpu':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-green-900/40 text-green-400 border border-green-800 rounded text-xs font-bold"><Zap className="w-3 h-3" /> 100% GPU</span>;
      case 'hybrid':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-900/40 text-yellow-400 border border-yellow-800 rounded text-xs font-bold"><Database className="w-3 h-3" /> HYBRID ({ollama.hybrid_percent.toFixed(0)}%)</span>;
      case 'cpu':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/40 text-blue-400 border border-blue-800 rounded text-xs font-bold"><Cpu className="w-3 h-3" /> CPU ONLY</span>;
      default:
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded text-xs font-bold">UNKNOWN</span>;
    }
  };

  return (
    <div className="flex flex-col p-4 bg-[#111827] border-2 border-gray-800 rounded-lg w-72 shadow-2xl font-mono text-sm text-gray-300 relative overflow-hidden">
      {/* Background glow based on usage */}
      <div 
        className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-opacity duration-300 ${ollama.location_state === 'cpu' ? 'bg-blue-500/10' : 'bg-orange-500/10'}`}
        style={{ opacity: (ollama.location_state === 'cpu' ? hardware.cpu_utilization : hardware.gpu_utilization) / 100 }}
      />

      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <div className="text-xs text-gray-500 font-bold tracking-wider mb-1">ACTIVE MODEL</div>
          <div className="font-bold text-white text-base truncate w-40">
            {isIdle ? <span className="text-gray-500 italic">Idle</span> : ollama.model_name}
          </div>
        </div>
        {!isIdle && getLocationBadge()}
      </div>

      <div className="space-y-4 z-10">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500 flex items-center gap-1">
              {ollama.location_state === 'cpu' ? <><Cpu className="w-3 h-3"/> CPU UTIL</> : <><Activity className="w-3 h-3"/> GPU UTIL</>}
            </span>
            <span className={`font-bold ${ollama.location_state === 'cpu' ? 'text-blue-400' : 'text-orange-400'}`}>
              {(ollama.location_state === 'cpu' ? hardware.cpu_utilization : hardware.gpu_utilization).toFixed(1)}%
            </span>
          </div>
          
          {/* Sparkline / Bar chart hybrid */}
          <div className="flex items-end h-8 gap-0.5 mt-2">
            {history.map((val, i) => (
              <div key={i} className="flex-1 bg-gray-800 rounded-t-sm overflow-hidden flex flex-col justify-end">
                <div 
                  className={`w-full transition-all duration-300 ease-out ${ollama.location_state === 'cpu' ? 'bg-blue-500' : 'bg-orange-500'}`}
                  style={{ height: `${Math.max(2, val)}%`, opacity: 0.3 + (val / 100) * 0.7 }}
                />
              </div>
            ))}
          </div>
        </div>

        {hardware.vram_total > 0 && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">VRAM USAGE</span>
              <span>
                <span className="text-white font-bold">{(hardware.vram_used / 1024 / 1024 / 1024).toFixed(1)}</span>
                <span className="text-gray-500"> / {(hardware.vram_total / 1024 / 1024 / 1024).toFixed(1)} GB</span>
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(hardware.vram_used / hardware.vram_total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {isIdle && (
          <div className="mt-2 flex items-center gap-2 text-xs text-yellow-500/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
            <AlertCircle className="w-4 h-4" />
            <span>No model currently loaded in memory.</span>
          </div>
        )}
      </div>
    </div>
  );
}
