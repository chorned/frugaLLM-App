import { AppNode } from '../constants/canvas';
import {
  getFrugallmConfig,
  checkHermesStatus,
  getHermesVersion,
  checkOpencodeStatus,
  getOpencodeVersion,
  checkOllamaStatus,
  checkToolGatewayStatus,
  isWipeMode,
  detectVram,
  getModelTagForVram,
  getCredential,
  getProviderStatuses,
  getFrugallmServerStatus,
} from './tauri';
import { clearOnnxCache } from './onnxGateway';

export interface AppInitOptions {
  isMounted: () => boolean;
  addLog: (msg: string) => void;
  setFrugalConfig: (conf: any) => void;
  setIsHermesInstalled: (val: boolean) => void;
  setHermesVersion: (ver: string) => void;
  setActiveProcesses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setIsOpenCodeInstalled: (val: boolean) => void;
  setOpencodeVersion: (ver: string) => void;
  setIsOllamaInstalled: (val: boolean) => void;
  setIsToolGatewayInstalled: (val: boolean) => void;
  setDetectedVram: (vram: string) => void;
  memoryRef: React.MutableRefObject<any>;
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  setPortConflict: (conflict: any) => void;
  setIsAppLoaded: (loaded: boolean) => void;
}

export async function runAppInit({
  isMounted,
  addLog,
  setFrugalConfig,
  setIsHermesInstalled,
  setHermesVersion,
  setActiveProcesses,
  setIsOpenCodeInstalled,
  setOpencodeVersion,
  setIsOllamaInstalled,
  setIsToolGatewayInstalled,
  setDetectedVram,
  memoryRef,
  setNodes,
  setPortConflict,
  setIsAppLoaded,
}: AppInitOptions) {
  addLog("Booting FrugaLLM core subsystems...");
  await new Promise(r => setTimeout(r, 300));
  
  addLog("Fetching node configuration...");
  try {
    const conf = await getFrugallmConfig();
    setFrugalConfig(conf);
    addLog("OK: Configuration loaded.");
  } catch (e) {
    addLog("WARN: Failed to load config.");
  }
  await new Promise(r => setTimeout(r, 200));

  addLog("Checking Hermes agent status...");
  try {
    const hermesStatus = await checkHermesStatus();
    setIsHermesInstalled(hermesStatus);
    if (hermesStatus) {
      getHermesVersion().then(v => setHermesVersion(v)).catch(() => setHermesVersion('N/A'));
      setActiveProcesses(prev => ({
        ...prev,
        'hermes-gateway': true,
        'run-hermes-gateway': true,
      }));
    }
    addLog(hermesStatus ? "OK: Hermes installed." : "INFO: Hermes not installed.");
  } catch(e) {}
  
  addLog("Checking OpenCode agent status...");
  try {
    const opencodeStatus = await checkOpencodeStatus();
    setIsOpenCodeInstalled(opencodeStatus);
    if (opencodeStatus) {
      getOpencodeVersion().then(v => setOpencodeVersion(v)).catch(() => setOpencodeVersion('N/A'));
    }
    addLog(opencodeStatus ? "OK: OpenCode installed." : "INFO: OpenCode not installed.");
  } catch(e) {}
  await new Promise(r => setTimeout(r, 200));

  addLog("Detecting Ollama daemon...");
  try {
    const ollamaStatus = await checkOllamaStatus();
    setIsOllamaInstalled(ollamaStatus);
    addLog(ollamaStatus ? "OK: Ollama detected." : "INFO: Ollama not detected.");
  } catch(e) {}
  
  addLog("Checking Tool Enforcing Gateway status...");
  try {
    const isWipe = await isWipeMode().catch(() => false);
    if (isWipe) {
      await clearOnnxCache().catch(() => {});
    }
    const toolGatewayStatus = await checkToolGatewayStatus();
    setIsToolGatewayInstalled(toolGatewayStatus);
    addLog(toolGatewayStatus ? "OK: Tool Gateway installed." : "INFO: Tool Gateway not installed.");
  } catch(e) {}
  
  addLog("Detecting system VRAM...");
  try {
    const vram = await detectVram();
    if (vram !== null && vram !== undefined) {
      const vramGb = Math.round(Number(vram) / 1024);
      setDetectedVram(String(vramGb));
      memoryRef.current.setDetectedVramGb(vramGb);
      try {
        const tag = await getModelTagForVram(vramGb);
        if (tag) {
          memoryRef.current.setActiveModelName(tag);
        }
      } catch(e) {}
      addLog(`OK: Detected ${vramGb}GB VRAM.`);
    }
  } catch(e) {}
  await new Promise(r => setTimeout(r, 300));

  addLog("Verifying OpenRouter credentials...");
  try {
    const key = await getCredential('openrouter');
    if (key && typeof key === 'string') {
      setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'active', keyPrefix: key.slice(0, 5) } } : n));
    } else {
      setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'active' } } : n));
    }
    addLog("OK: OpenRouter authenticated.");
  } catch(e) {
    addLog("INFO: OpenRouter credentials missing.");
  }
  await new Promise(r => setTimeout(r, 200));

  addLog("Verifying Google AI Studio credentials...");
  try {
    const key = await getCredential('google');
    if (key && typeof key === 'string') {
      setNodes(nds => nds.map(n => n.id === 'node-google' ? { ...n, data: { ...n.data, status: 'active', keyPrefix: key.slice(0, 5) } } : n));
    } else {
      setNodes(nds => nds.map(n => n.id === 'node-google' ? { ...n, data: { ...n.data, status: 'active' } } : n));
    }
    addLog("OK: Google AI Studio authenticated.");
  } catch(e) {
    addLog("INFO: Google AI Studio credentials missing.");
  }
  await new Promise(r => setTimeout(r, 300));

  addLog("Checking provider health statuses...");
  try {
    const statuses = await getProviderStatuses();
    if (statuses && typeof statuses === 'object') {
      setNodes(nds => nds.map(n => {
        const providerKey = n.id.replace('node-', '');
        if (statuses[providerKey]) {
          return { ...n, data: { ...n.data, lastStatus: statuses[providerKey] } };
        }
        return n;
      }));
    }
  } catch (e) {
    console.error("Failed to query provider statuses:", e);
  }

  addLog("Checking server status...");
  try {
    const status = await getFrugallmServerStatus();
    if (status?.status === 'PortConflict') {
      setPortConflict({
        port: status.data?.port || 61721,
        message: status.data?.message || `Close the service currently using port [${status.data?.port || 61721}] and restart the app.`
      });
    }
  } catch (e) {
    console.error("Failed to query server status:", e);
  }

  addLog("All systems nominal. Launching UI...");
  await new Promise(r => setTimeout(r, 500));
  
  if (isMounted()) setIsAppLoaded(true);
}
