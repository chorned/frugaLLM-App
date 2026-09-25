import React from 'react';
import {
  killPty,
  stopHermesService,
  deleteLocalModel,
  deleteCredential,
  refreshRoutingChain,
  setModelOverride,
  setFrugallmConfig,
  getFrugallmServerStatus,
  setCredential,
  launchNativeAppSession,
  safeFetch,
} from '../services/tauri';
import confetti from 'canvas-confetti';
import { AppNode } from '../constants/canvas';
import en from '../locales/en.json';

interface UseNodeActionsProps {
  terminalMode: string | null;
  setTerminalMode: (mode: any) => void;
  setActiveProcesses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setIsHermesInstalled: (val: boolean) => void;
  setIsHermesManaged?: (val: boolean) => void;
  setIsOpenCodeInstalled: (val: boolean) => void;
  setIsOpenCodeManaged?: (val: boolean) => void;
  setIsOllamaInstalled: (val: boolean) => void;
  setIsOllamaManaged?: (val: boolean) => void;
  setIsToolGatewayInstalled?: (val: boolean) => void;
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  frugalConfig: any;
  setFrugalConfig: (conf: any) => void;
  setPortConflict: (conflict: any) => void;
  setSelectedNodeId: (id: string | null) => void;
  onStatusChange?: () => void;
}

export function useNodeActions({
  terminalMode,
  setTerminalMode,
  setActiveProcesses,
  setIsHermesInstalled: _setIsHermesInstalled,
  setIsHermesManaged: _setIsHermesManaged,
  setIsOpenCodeInstalled: _setIsOpenCodeInstalled,
  setIsOpenCodeManaged: _setIsOpenCodeManaged,
  setIsOllamaInstalled: _setIsOllamaInstalled,
  setIsOllamaManaged: _setIsOllamaManaged,
  setIsToolGatewayInstalled: _setIsToolGatewayInstalled,
  setNodes,
  frugalConfig,
  setFrugalConfig,
  setPortConflict,
  setSelectedNodeId,
  onStatusChange,
}: UseNodeActionsProps) {
  const handleInitializeHermes = () => setTerminalMode('install-hermes');
  const handleOpenHermes = () => {
    setSelectedNodeId(null);
    setActiveProcesses(prev => ({ ...prev, 'hermes-cli': true }));
    launchNativeAppSession('hermes', undefined, frugalConfig?.hermes_workspace || undefined).catch(console.error);
  };
  const handleOpenHermesGateway = () => {
    setSelectedNodeId(null);
    setTerminalMode('run-hermes-gateway');
  };
  const handleOpenHermesDesktop = () => {
    setSelectedNodeId(null);
    setTerminalMode('run-hermes-desktop');
  };
  const handleOpenHermesWeb = () => {
    setSelectedNodeId(null);
    setTerminalMode('run-hermes-web');
  };
  const handleKillProcess = (mode: string) => {
    killPty(mode).catch(console.error);
    stopHermesService(mode).catch(console.error);
    if (mode === 'run-hermes-desktop') {
      killPty('run-hermes-desktop').catch(console.error);
      setActiveProcesses(prev => ({ ...prev, 'run-hermes-desktop': false }));
    }
    if (mode === 'run-hermes-gateway' || mode === 'hermes-gateway') {
      killPty('run-hermes-gateway').catch(console.error);
      stopHermesService('gateway').catch(console.error);
      setActiveProcesses(prev => ({ ...prev, 'run-hermes-gateway': false, 'hermes-gateway': false }));
    }
    if (mode === 'run-hermes-web' || mode === 'hermes-dashboard') {
      killPty('run-hermes-web').catch(console.error);
      stopHermesService('dashboard').catch(console.error);
      setActiveProcesses(prev => ({ ...prev, 'run-hermes-web': false, 'hermes-dashboard': false }));
    }
    setActiveProcesses(prev => ({
      ...prev,
      [mode]: false,
      [mode.replace('run-', '')]: false,
      [`hermes-${mode.replace('run-hermes-', '')}`]: false,
      ...(mode === 'run-hermes-gateway' || mode === 'run-hermes-desktop' || mode === 'hermes-gateway' ? {
        'run-hermes-gateway': false,
        'run-hermes-desktop': false,
        'hermes-gateway': false,
        'hermes-desktop': false,
      } : {}),
      ...(mode === 'run-hermes-web' || mode === 'hermes-dashboard' ? {
        'run-hermes-web': false,
        'hermes-web': false,
        'hermes-dashboard': false,
      } : {})
    }));
    if (terminalMode === mode || (mode === 'run-hermes-gateway' && terminalMode === 'run-hermes-desktop')) {
      setTerminalMode(null);
    }
  };
  const handleInitializeOpenCode = () => setTerminalMode('install-opencode');
  const handleOpenOpenCode = () => {
    setSelectedNodeId(null);
    setActiveProcesses(prev => ({ ...prev, 'run-opencode': true }));
    launchNativeAppSession('opencode', undefined, frugalConfig?.opencode_workspace || undefined).catch(console.error);
  };
  const handleOpenOpenCodeWeb = () => {
    setSelectedNodeId(null);
    setTerminalMode('run-opencode-web');
  };
  const handleInitializeOllama = () => setTerminalMode('install-ollama');
  const handleOpenOllama = () => {
    launchNativeAppSession('ollama').catch(console.error);
  };
  const handleInstallToolGateway = () => setTerminalMode('install-tool-gateway');
  const handleUninstallToolGateway = () => setTerminalMode('uninstall-tool-gateway');

  const handleUninstallHermes = () => setTerminalMode('uninstall-hermes');
  const handleUninstallOpenCode = () => setTerminalMode('uninstall-opencode');
  const handleDeleteLocalModel = async () => {
    try {
      await deleteLocalModel();
      await refreshRoutingChain().catch(console.error);
    } catch (e) {
      console.error('Failed to delete local model:', e);
    }
  };
  const handleUninstallOllama = () => setTerminalMode('uninstall-ollama');
  const handleDisconnectOpenRouter = async () => {
    await deleteCredential('openrouter').catch(console.error);
    setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'needs_activation', apiKey: '', keyPrefix: '', lastStatus: '' } } : n));
    await refreshRoutingChain().catch(console.error);
    onStatusChange?.();
  };
  const handleDisconnectGoogle = async () => {
    await deleteCredential('google').catch(console.error);
    setNodes(nds => nds.map(n => n.id === 'node-google' ? { ...n, data: { ...n.data, status: 'needs_activation', googleApiKey: '', keyPrefix: '', lastStatus: '' } } : n));
    await refreshRoutingChain().catch(console.error);
    onStatusChange?.();
  };

  const handleNodeClick = (e: any, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
  };

  const handleSaveNodeConfig = async (nodeId: string, newConfig: any) => {
    let finalConfig = { ...newConfig };
    
    if (nodeId === 'node-frugallm') {
      try {
        const newConf = {
          port: parseInt(finalConfig.port, 10),
          bind_all_interfaces: finalConfig.bind_all_interfaces,
          api_password: finalConfig.api_password || null,
          manual_model_overrides: finalConfig.manual_model_overrides !== undefined ? finalConfig.manual_model_overrides : (frugalConfig?.manual_model_overrides || []),
          input_tokens_session: frugalConfig?.input_tokens_session || 0,
          output_tokens_session: frugalConfig?.output_tokens_session || 0,
          input_tokens_lifetime: frugalConfig?.input_tokens_lifetime || 0,
          output_tokens_lifetime: frugalConfig?.output_tokens_lifetime || 0,
          hermes_workspace: frugalConfig?.hermes_workspace || null,
          opencode_workspace: frugalConfig?.opencode_workspace || null,
          start_minimized: Boolean(finalConfig.start_minimized),
          installed_by_app: frugalConfig?.installed_by_app,
        };
        await setFrugallmConfig(newConf);
        setFrugalConfig((prev: any) => ({ ...(prev || {}), ...newConf }));
        getFrugallmServerStatus().then((st: any) => {
          if (st?.status === 'Running') {
            setPortConflict(null);
          }
        }).catch(() => {});
        if (finalConfig.manual_model_overrides !== undefined) {
          await setModelOverride(finalConfig.manual_model_overrides);
          await refreshRoutingChain().catch(console.error);
        }
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ea580c', '#ffffff', '#111827']
        });
      } catch (e: any) {
        console.error("Failed to update FrugalLM config: ", e);
      }
      return;
    }
    
    if (nodeId === 'node-hermes' || nodeId === 'node-opencode') {
      try {
        const newConf = {
          port: frugalConfig?.port || 0,
          bind_all_interfaces: frugalConfig?.bind_all_interfaces || false,
          api_password: frugalConfig?.api_password || null,
          input_tokens_session: frugalConfig?.input_tokens_session || 0,
          output_tokens_session: frugalConfig?.output_tokens_session || 0,
          input_tokens_lifetime: frugalConfig?.input_tokens_lifetime || 0,
          output_tokens_lifetime: frugalConfig?.output_tokens_lifetime || 0,
          hermes_workspace: nodeId === 'node-hermes' ? (finalConfig.hermes_workspace || null) : (frugalConfig?.hermes_workspace || null),
          opencode_workspace: nodeId === 'node-opencode' ? (finalConfig.opencode_workspace || null) : (frugalConfig?.opencode_workspace || null),
        };
        await setFrugallmConfig(newConf);
        setFrugalConfig((prev: any) => ({ ...(prev || {}), ...newConf }));
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ea580c', '#ffffff', '#111827']
        });
      } catch (e: any) {
        console.error("Failed to update config: " + e);
      }
    }
    

    
    let saveResult: { ok: boolean; status?: string; error?: string } = { ok: true };

    if (nodeId === 'node-google') {
      if (finalConfig.googleApiKey) {
        let probeOk = false;
        let probeStatus = '';
        let probeError = '';

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const res = await safeFetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${finalConfig.googleApiKey}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            probeOk = true;
          } else {
            console.error("Google API key test failed", res.status);
            probeStatus = `${res.status}`;
            probeError = en.routingGraph.nodeConfigPanel.inputs.googleApiKey.errorVerificationFailed.replace('{{status}}', String(res.status));
          }
        } catch (e) {
          console.error("Google probe network error", e);
          probeStatus = 'offline';
          probeError = en.routingGraph.nodeConfigPanel.inputs.googleApiKey.errorOffline;
        }

        if (probeOk) {
          await setCredential('google', finalConfig.googleApiKey);
          finalConfig.keyPrefix = finalConfig.googleApiKey.slice(0, 5);
          finalConfig.status = 'active';
          finalConfig.lastStatus = '200 OK';
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...finalConfig } } : n));
          await refreshRoutingChain().catch(console.error);
          onStatusChange?.();
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#ffffff', '#111827']
          });
        } else {
          // Do not switch into connected/disconnect state: return to original state
          saveResult = {
            ok: false,
            status: probeStatus,
            error: probeError,
          };
          delete finalConfig.keyPrefix;
          delete finalConfig.status;
          delete finalConfig.lastStatus;
        }
        delete finalConfig.googleApiKey;
      }
    }
    
    if (nodeId === 'node-openrouter') {
      if (finalConfig.apiKey) {
        let probeOk = false;
        let probeStatus = '';
        let probeError = '';

        try {
          const res = await safeFetch(`https://openrouter.ai/api/v1/auth/key`, { 
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${finalConfig.apiKey}`,
              'HTTP-Referer': 'https://github.com/chorned/frugaLLM',
              'X-Title': 'FrugaLLM'
            }
          });
          if (res.ok) {
            probeOk = true;
          } else {
            console.error("OpenRouter API key test failed", res.status);
            probeStatus = `${res.status}`;
            probeError = en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.errorVerificationFailed.replace('{{status}}', String(res.status));
          }
        } catch (e) {
          console.error("Failed to test openrouter credential", e);
          probeStatus = 'offline';
          probeError = en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.errorOffline;
        }

        if (probeOk) {
          await setCredential('openrouter', finalConfig.apiKey);
          finalConfig.keyPrefix = finalConfig.apiKey.slice(0, 5);
          finalConfig.status = 'active';
          finalConfig.lastStatus = '200 OK';
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...finalConfig } } : n));
          await refreshRoutingChain().catch(console.error);
          onStatusChange?.();
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ea580c', '#ffffff', '#111827']
          });
        } else {
          // Do not switch into connected/disconnect state: return to original state
          saveResult = {
            ok: false,
            status: probeStatus,
            error: probeError,
          };
          delete finalConfig.keyPrefix;
          delete finalConfig.status;
          delete finalConfig.lastStatus;
        }
        delete finalConfig.apiKey;
      }
    }
    
    if (nodeId === 'node-ollama') {
      try {
        const res = await safeFetch(`http://${finalConfig.ip}:${finalConfig.port}/api/version`, { method: 'GET' });
        if (res.ok) {
          await refreshRoutingChain().catch(console.error);
          finalConfig.status = 'active';
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ea580c', '#ffffff', '#111827']
          });
        } else {
          finalConfig.status = 'error';
        }
      } catch (e) {
        console.error("Failed to connect to Ollama", e);
        finalConfig.status = 'error';
      }
    }

    if (nodeId !== 'node-frugallm' && nodeId !== 'node-google' && nodeId !== 'node-openrouter' && nodeId !== 'node-ollama' && nodeId !== 'node-hermes' && nodeId !== 'node-opencode') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ea580c', '#ffffff', '#111827']
      });
    }
    
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...finalConfig } } : n));
    return saveResult;
  };

  return {
    handleInitializeHermes,
    handleOpenHermes,
    handleOpenHermesGateway,
    handleOpenHermesDesktop,
    handleOpenHermesWeb,
    handleKillProcess,
    handleInitializeOpenCode,
    handleOpenOpenCode,
    handleOpenOpenCodeWeb,
    handleInitializeOllama,
    handleOpenOllama,
    handleInstallToolGateway,
    handleUninstallToolGateway,
    handleUninstallHermes,
    handleUninstallOpenCode,
    handleUninstallOllama,
    handleDeleteLocalModel,
    handleDisconnectOpenRouter,
    handleDisconnectGoogle,
    handleNodeClick,
    handleSaveNodeConfig,
  };
}
