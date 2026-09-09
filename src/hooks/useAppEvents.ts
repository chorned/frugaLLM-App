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
}: UseAppEventsProps) {
  useEffect(() => {
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
        } else if (status === 'offline') {
          setNodes(nds => nds.map(n => n.id === 'node-ollama' && n.data.status !== 'needs_activation' ? { ...n, data: { ...n.data, status: 'needs_activation' } } : n));
        }
      });
      return unlisten;
    };

    let unlistenTelemetry: (() => void) | null = null;
    setupTelemetryListener().then(unlisten => {
      unlistenTelemetry = unlisten;
    }).catch(console.error);

    let unlistenProxy: (() => void) | null = null;
    listen<ProxyActivityPayload>('proxy_activity', (event) => {
      handleProxyActivityEvent(event.payload);
    }).then(unlisten => {
      unlistenProxy = unlisten;
    }).catch(console.error);

    let unlistenExit: (() => void) | null = null;
    listen('request_exit_confirmation', async () => {
      try {
        const svcs = await getActiveServices();
        setExitServices(svcs && svcs.length > 0 ? svcs : ['Hermes Service']);
      } catch {
        setExitServices(['Hermes Service']);
      }
      setShowExitModal(true);
    }).then(unlisten => {
      unlistenExit = unlisten;
    }).catch(console.error);

    let unlistenServiceExit: (() => void) | null = null;
    listen<{ service: string }>('service_exit', (event) => {
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
    }).then(unlisten => {
      unlistenServiceExit = unlisten;
    }).catch(console.error);

    let unlistenConfig: (() => void) | null = null;
    listen('frugallm_config_updated', () => {
      getFrugallmConfig().then((conf: any) => setFrugalConfig(conf)).catch(console.error);
    }).then(unlisten => {
      unlistenConfig = unlisten;
    }).catch(console.error);

    let unlistenError: (() => void) | null = null;
    listen('frugallm_port_error', (event: any) => {
      const port = event.payload;
      const numericPort = typeof port === 'number' ? port : parseInt(port, 10);
      setPortConflict({
        port: numericPort || 61721,
        message: `Close the service currently using port [${numericPort || 61721}] and restart the app.`
      });
    }).then(unlisten => {
      unlistenError = unlisten;
    }).catch(console.error);

    let unlistenStatus: (() => void) | null = null;
    listen('frugallm_server_status', (event: any) => {
      const statusObj = event.payload;
      if (statusObj?.status === 'PortConflict') {
        setPortConflict({
          port: statusObj.data?.port || 61721,
          message: statusObj.data?.message || `Close the service currently using port [${statusObj.data?.port || 61721}] and restart the app.`
        });
      } else if (statusObj?.status === 'Running') {
        setPortConflict(null);
      }
    }).then(unlisten => {
      unlistenStatus = unlisten;
    }).catch(console.error);

    let unlistenProviderStatus: (() => void) | null = null;
    listen('provider_status', (event: any) => {
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
    }).then(unlisten => {
      unlistenProviderStatus = unlisten;
    }).catch(console.error);

    return () => {
      if (unlistenTelemetry) {
        unlistenTelemetry();
      }
      if (unlistenProxy) {
        unlistenProxy();
      }
      if (unlistenExit) {
        unlistenExit();
      }
      if (unlistenServiceExit) {
        unlistenServiceExit();
      }
      if (unlistenConfig) {
        unlistenConfig();
      }
      if (unlistenError) {
        unlistenError();
      }
      if (unlistenStatus) {
        unlistenStatus();
      }
      if (unlistenProviderStatus) {
        unlistenProviderStatus();
      }
      cleanupProxyIndicator();
    };
  }, [memoryRef, setLatestTelemetry, setHardwareProfile, setIsOllamaInstalled, setNodes, handleProxyActivityEvent, setExitServices, setShowExitModal, setActiveProcesses, cleanupProxyIndicator, setFrugalConfig, setPortConflict]);
}
