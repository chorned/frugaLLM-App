import React from 'react';
import {
  killPty,
  stopHermesService,
  spawnPty,
  uninstallOllama,
  uninstallOpenCode,
  uninstallHermes,
  deleteCredential,
  refreshRoutingChain,
  setModelOverride,
  setFrugallmConfig,
  getFrugallmConfig,
  getFrugallmServerStatus,
  setCredential,
} from '../services/tauri';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import confetti from 'canvas-confetti';
import { AppNode } from '../constants/canvas';

interface UseNodeActionsProps {
  terminalMode: string | null;
  setTerminalMode: (mode: any) => void;
  setActiveProcesses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setIsHermesInstalled: (val: boolean) => void;
  setIsOpenCodeInstalled: (val: boolean) => void;
  setIsOllamaInstalled: (val: boolean) => void;
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  frugalConfig: any;
  setFrugalConfig: (conf: any) => void;
  setPortConflict: (conflict: any) => void;
  setSelectedNodeId: (id: string | null) => void;
}

export function useNodeActions({
  terminalMode,
  setTerminalMode,
  setActiveProcesses,
  setIsHermesInstalled,
  setIsOpenCodeInstalled,
  setIsOllamaInstalled,
  setNodes,
  frugalConfig,
  setFrugalConfig,
  setPortConflict,
  setSelectedNodeId,
}: UseNodeActionsProps) {
  const handleInitializeHermes = () => setTerminalMode('install-hermes');
  const handleOpenHermes = () => setTerminalMode('run-hermes');
  const handleOpenHermesGateway = () => setTerminalMode('run-hermes-gateway');
  const handleOpenHermesDesktop = () => setTerminalMode('run-hermes-desktop');
  const handleOpenHermesWeb = () => setTerminalMode('run-hermes-web');
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
  const handleOpenOpenCode = () => setTerminalMode('run-opencode');
  const handleOpenOpenCodeWeb = () => setTerminalMode('run-opencode-web');
  const handleInitializeOllama = () => setTerminalMode('install-ollama');
  const handleOpenOllama = () => setTerminalMode('run-ollama');
  const handleInstallToolGateway = () => setTerminalMode('install-tool-gateway');
  const handleUninstallToolGateway = () => setTerminalMode('uninstall-tool-gateway');

  const handleUninstallHermes = async () => {
    try {
      await uninstallHermes();
    } catch (e) {
      console.error('Failed to uninstall Hermes:', e);
    }
    setIsHermesInstalled(false);
  };
  const handleUninstallOpenCode = async () => {
    try {
      await uninstallOpenCode();
    } catch (e) {
      console.error('Failed to uninstall OpenCode:', e);
    }
    setIsOpenCodeInstalled(false);
  };
  const handleUninstallOllama = async () => {
    try {
      await uninstallOllama();
    } catch (e) {
      console.error('Failed to uninstall Ollama:', e);
    }
    setIsOllamaInstalled(false);
    setNodes(nds => nds.map(n => n.id === 'node-ollama' ? { ...n, data: { ...n.data, status: 'ready' } } : n));
  };
  const handleDisconnectOpenRouter = async () => {
    await deleteCredential('openrouter').catch(console.error);
    setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'needs_activation', apiKey: '', keyPrefix: '', lastStatus: '' } } : n));
    await refreshRoutingChain().catch(console.error);
  };
  const handleDisconnectGoogle = async () => {
    await deleteCredential('google').catch(console.error);
    setNodes(nds => nds.map(n => n.id === 'node-google' ? { ...n, data: { ...n.data, status: 'needs_activation', googleApiKey: '', keyPrefix: '', lastStatus: '' } } : n));
    await refreshRoutingChain().catch(console.error);
  };

  const handleNodeClick = (e: any, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
  };

  const handleSaveNodeConfig = async (nodeId: string, newConfig: any) => {
    let finalConfig = { ...newConfig };
    
    if (nodeId === 'node-frugallm') {
      try {
        if (finalConfig.manual_model_overrides !== undefined) {
          await setModelOverride(finalConfig.manual_model_overrides);
          await refreshRoutingChain().catch(console.error);
        }
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
        };
        await setFrugallmConfig(newConf);
        getFrugallmConfig().then((conf: any) => setFrugalConfig(conf)).catch(console.error);
        getFrugallmServerStatus().then((st: any) => {
          if (st?.status === 'Running') {
            setPortConflict(null);
          }
        }).catch(() => {});
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ea580c', '#ffffff', '#111827']
        });
      } catch (e: any) {
        alert("Failed to update FrugalLM config: " + e);
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
        getFrugallmConfig().then((conf: any) => setFrugalConfig(conf)).catch(console.error);
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
    

    
    if (nodeId === 'node-google') {
      if (finalConfig.googleApiKey) {
        await setCredential('google', finalConfig.googleApiKey);
        await refreshRoutingChain().catch(console.error);
        finalConfig.status = 'active';
        finalConfig.keyPrefix = finalConfig.googleApiKey.slice(0, 5);

        try {
          const probeCandidates = [
            'gemini-flash-latest',
            'gemini-3.5-flash',
            'gemma-4-26b-a4b-it'
          ];
          let lastStat = 'offline';
          let verifiedOk = false;

          for (const cand of probeCandidates) {
            const res = await tauriFetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${cand}:generateContent?key=${finalConfig.googleApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: 'ping' }] }],
                  generationConfig: { maxOutputTokens: 1 }
                })
              }
            );
            if (res.ok) {
              verifiedOk = true;
              finalConfig.lastStatus = '200 OK';
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#3b82f6', '#ffffff', '#111827']
              });
              break;
            } else {
              lastStat = `${res.status}`;
              if (res.status === 403) {
                break;
              }
            }
          }

          if (!verifiedOk) {
            console.error("Google API key test failed", lastStat);
            finalConfig.lastStatus = lastStat;
          }
        } catch (e) {
          console.error("Failed to test google credential", e);
          finalConfig.lastStatus = 'offline';
        }
        delete finalConfig.googleApiKey;
      }
    }
    
    if (nodeId === 'node-openrouter') {
      if (finalConfig.apiKey) {
        await setCredential('openrouter', finalConfig.apiKey);
        await refreshRoutingChain().catch(console.error);
        finalConfig.status = 'active';
        finalConfig.keyPrefix = finalConfig.apiKey.slice(0, 5);

        try {
          const res = await tauriFetch(`https://openrouter.ai/api/v1/auth/key`, { 
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${finalConfig.apiKey}`,
              'HTTP-Referer': 'https://github.com/chorned/frugaLLM',
              'X-Title': 'FrugaLLM'
            }
          });
          if (res.ok) {
            finalConfig.lastStatus = '200 OK';
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#ea580c', '#ffffff', '#111827']
            });
          } else {
            console.error("OpenRouter API key test failed", res.status);
            finalConfig.lastStatus = `${res.status}`;
          }
        } catch (e) {
          console.error("Failed to test openrouter credential", e);
          finalConfig.lastStatus = 'offline';
        }
        delete finalConfig.apiKey;
      }
    }
    
    if (nodeId === 'node-ollama') {
      try {
        const res = await tauriFetch(`http://${finalConfig.ip}:${finalConfig.port}/api/version`, { method: 'GET' });
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
    handleDisconnectOpenRouter,
    handleDisconnectGoogle,
    handleNodeClick,
    handleSaveNodeConfig,
  };
}
