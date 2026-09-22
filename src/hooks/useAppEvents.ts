import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getActiveServices, getFrugallmConfig } from '../services/tauri';
import { ProxyActivityPayload } from './useProxyActivityIndicator';
import { AppNode } from '../constants/canvas';

interface UseAppEventsProps {
  memoryRef: React.MutableRefObject<any>;
  setLatestTelemetry: (t: any) => void;
  setHardwareProfile: (p: any) => void;
  setIsOllamaInstalled: (v: boolean) => void;
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  handleProxyActivityEvent: (payload: ProxyActivityPayload) => void;
  setExitServices: (svcs: string[]) => void;
  setShowExitModal: (show: boolean) => void;
  setActiveProcesses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  cleanupProxyIndicator: () => void;
  setFrugalConfig: (conf: any) => void;
  setPortConflict: (conflict: any) => void;
  setDaemonError?: (err: string | null) => void;
}

export function useAppEvents({
  memoryRef,
  setLatestTelemetry,
  setHardwareProfile,
  setIsOllamaInstalled,
  setNodes,
  handleProxyActivityEvent,
  setExitServices,
  setShowExitModal,
  setActiveProcesses,
  cleanupProxyIndicator,
  setFrugalConfig,
  setPortConflict,
  setDaemonError,
}: UseAppEventsProps) {
  useEffect(() => {
    let disposed = false;
    const cleanups: (() => void)[] = [];

    const registerListener = (promise: Promise<() => void>) => {
      promise.then(unlisten => {
        if (disposed) {
          unlisten();
        } else {
          cleanups.push(unlisten);
        }
      }).catch(console.error);
    };

    const setupTelemetryListener = async () => {
      let unlisten = await listen<any>('telemetry_update', (event) => {
        setLatestTelemetry(event.payload);
        if (event.payload) {
          memoryRef.current.setLatestTelemetry(event.payload);
          if (event.payload.hardware_profile) {
            setHardwareProfile(event.payload.hardware_profile);
            memoryRef.current.setHardwareProfile(event.payload.hardware_profile);
          }
          if (event.payload.hardware?.vram_total) {
            memoryRef.current.setDetectedVramGb(Math.round(event.payload.hardware.vram_total / 1024 / 1024 / 1024));
          }
        }
        const status = event.payload?.ollama?.status;
        if (status === 'active' || status === 'idle') {
          setIsOllamaInstalled(true);
          setNodes(nds => nds.map(n => n.id === 'node-ollama' && n.data.status !== 'active' ? { ...n, data: { ...n.data, status: 'active' } } : n));
          if (event.payload?.ollama?.model_name) {
            memoryRef.current.setActiveModelName(event.payload.ollama.model_name);
          }
        } else if (status === 'offline') {
          setNodes(nds => nds.map(n => n.id === 'node-ollama' && n.data.status !== 'needs_activation' ? { ...n, data: { ...n.data, status: 'needs_activation' } } : n));
        }
      });
      return unlisten;
    };

    registerListener(setupTelemetryListener());

    registerListener(listen<ProxyActivityPayload>('proxy_activity', (event) => {
      handleProxyActivityEvent(event.payload);
    }));

    registerListener(listen('request_exit_confirmation', async () => {
      try {
        const svcs = await getActiveServices();
        setExitServices(svcs && svcs.length > 0 ? svcs : ['Hermes Service']);
      } catch {
        setExitServices(['Hermes Service']);
      }
      setShowExitModal(true);
    }));

    registerListener(listen<{ service: string }>('service_exit', (event) => {
      const svc = event.payload?.service;
      if (svc) {
        setActiveProcesses(prev => ({
          ...prev,
          [svc]: false,
          [`run-${svc}`]: false,
          [svc.replace('hermes-', 'run-hermes-')]: false,
          ...(svc === 'hermes-gateway' || svc === 'gateway' ? { 'run-hermes-gateway': false, 'run-hermes-desktop': false, 'hermes-gateway': false } : {}),
          ...(svc === 'hermes-dashboard' || svc === 'dashboard' ? { 'run-hermes-web': false, 'hermes-dashboard': false } : {}),
        }));
      }
    }));

    registerListener(listen('frugallm_config_updated', () => {
      getFrugallmConfig().then((conf: any) => setFrugalConfig(conf)).catch(console.error);
    }));

    registerListener(listen('frugallm_port_error', (event: any) => {
      const port = event.payload;
      const numericPort = typeof port === 'number' ? port : parseInt(port, 10);
      setPortConflict({
        port: numericPort || 61721,
        message: `Close the service currently using port [${numericPort || 61721}] and restart the app.`,
        showBanner: true,
      });
    }));

    registerListener(listen('frugallm_server_status', (event: any) => {
      const statusObj = event.payload;
      if (statusObj?.status === 'PortConflict') {
        setPortConflict({
          port: statusObj.data?.port || 61721,
          message: statusObj.data?.message || `Close the service currently using port [${statusObj.data?.port || 61721}] and restart the app.`,
          showBanner: true,
        });
      } else if (statusObj?.status === 'Running') {
        setPortConflict(null);
        setDaemonError?.(null);
      } else if (statusObj?.status === 'Error') {
        setDaemonError?.(statusObj.data?.message || 'Daemon failure');
      }
    }));

    registerListener(listen('daemon_error', (event: any) => {
      const msg = typeof event.payload === 'string' ? event.payload : event.payload?.message || 'Daemon failure';
      setDaemonError?.(msg);
    }));

    registerListener(listen('provider_status', (event: any) => {
      const { provider, status } = event.payload || {};
      if (!provider) return;
      const targetId = `node-${provider}`;
      setNodes(nds => nds.map(n => {
        if (n.id === targetId) {
          return {
            ...n,
            data: {
              ...n.data,
              lastStatus: status
            }
          };
        }
        return n;
      }));
    }));

    registerListener(listen('ollama_uninstalled', () => {
      setIsOllamaInstalled(false);
      setNodes(nds => nds.map(n => n.id === 'node-ollama' ? { ...n, data: { ...n.data, status: 'ready' } } : n));
    }));

    return () => {
      disposed = true;
      cleanups.forEach(unlisten => {
        try { unlisten(); } catch (e) { console.error(e); }
      });
      cleanupProxyIndicator();
    };
  }, [memoryRef, setLatestTelemetry, setHardwareProfile, setIsOllamaInstalled, setNodes, handleProxyActivityEvent, setExitServices, setShowExitModal, setActiveProcesses, cleanupProxyIndicator, setFrugalConfig, setPortConflict, setDaemonError]);
}
