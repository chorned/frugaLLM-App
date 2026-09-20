import React from 'react';
import { createPortal } from 'react-dom';
import { TerminalView } from './TerminalView';
import { checkHermesStatus, checkOpencodeStatus, checkOllamaStatus, checkToolGatewayStatus, getOllamaChatModel, refreshRoutingChain } from '../services/tauri';
import { AppNode } from '../constants/canvas';

export interface TerminalOverlaysProps {
  terminalMode: string | null;
  activeProcesses: Record<string, boolean>;
  setTerminalMode: (mode: any) => void;
  setActiveProcesses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  frugalConfig: any;
  setFrugalConfig: any;
  setIsHermesInstalled: (installed: boolean) => void;
  setIsHermesManaged?: (managed: boolean) => void;
  setIsOpenCodeInstalled: (installed: boolean) => void;
  setIsOpenCodeManaged?: (managed: boolean) => void;
  setIsOllamaInstalled: (installed: boolean) => void;
  setIsOllamaManaged?: (managed: boolean) => void;
  setIsToolGatewayInstalled?: (installed: boolean) => void;
  setNodes?: React.Dispatch<React.SetStateAction<AppNode[]>>;
  memoryRef?: React.MutableRefObject<any>;
}

const TERMINAL_MODES = [
  'install-hermes',
  'run-hermes',
  'run-hermes-web',
  'run-hermes-gateway',
  'run-hermes-desktop',
  'install-opencode',
  'run-opencode',
  'run-opencode-web',
  'install-ollama',
  'run-ollama',
  'install-tool-gateway',
  'uninstall-tool-gateway',
  'uninstall-hermes',
  'uninstall-opencode',
  'uninstall-ollama',
] as const;

export const TerminalOverlays: React.FC<TerminalOverlaysProps> = ({
  terminalMode,
  activeProcesses,
  setTerminalMode,
  setActiveProcesses,
  frugalConfig,
  setFrugalConfig,
  setIsHermesInstalled,
  setIsHermesManaged,
  setIsOpenCodeInstalled,
  setIsOpenCodeManaged,
  setIsOllamaInstalled,
  setIsOllamaManaged,
  setIsToolGatewayInstalled,
  setNodes,
  memoryRef,
}) => {
  const content = (
    <>
      {TERMINAL_MODES.map((mode) => {
        const isActive = activeProcesses[mode] || terminalMode === mode;
        if (!isActive) return null;
        return (
          <div
            key={mode}
            data-testid={`terminal-overlay-${mode}`}
            style={{
              display: terminalMode === mode ? 'flex' : 'none',
              width: '100%',
              height: '100%',
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 10000,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <TerminalView
               mode={mode}
               sessionId={mode}
               onExit={() => {
                 setTerminalMode(null);
                 checkHermesStatus().then((status) => {
                   setIsHermesInstalled(status.is_installed);
                   setIsHermesManaged?.(status.is_managed);
                 });
                 checkOpencodeStatus().then((status) => {
                   setIsOpenCodeInstalled(status.is_installed);
                   setIsOpenCodeManaged?.(status.is_managed);
                 });
                 checkOllamaStatus().then(async (status) => {
                   setIsOllamaInstalled(status.is_installed);
                   setIsOllamaManaged?.(status.is_managed);
                   if (status.is_installed) {
                     setNodes?.(nds => nds.map(n => n.id === 'node-ollama' ? { ...n, data: { ...n.data, status: 'active' } } : n));
                     try {
                       const model = await getOllamaChatModel();
                       if (model && memoryRef?.current) {
                         memoryRef.current.setActiveModelName(model);
                       }
                     } catch(e) {}
                     refreshRoutingChain().catch(() => {});
                   } else {
                     setNodes?.(nds => nds.map(n => n.id === 'node-ollama' ? { ...n, data: { ...n.data, status: 'ready' } } : n));
                   }
                 });
                 checkToolGatewayStatus().then((installed) => setIsToolGatewayInstalled?.(installed));
               }}
               onProcessStart={() => setActiveProcesses(prev => ({ ...prev, [mode]: true }))}
               onProcessExit={() => setActiveProcesses(prev => ({ ...prev, [mode]: false }))}
               frugalConfig={frugalConfig}
               setFrugalConfig={setFrugalConfig}
               setIsHermesInstalled={setIsHermesInstalled}
               setIsHermesManaged={setIsHermesManaged}
               setIsOpenCodeInstalled={setIsOpenCodeInstalled}
               setIsOpenCodeManaged={setIsOpenCodeManaged}
               setIsOllamaInstalled={setIsOllamaInstalled}
               setIsOllamaManaged={setIsOllamaManaged}
               setIsToolGatewayInstalled={setIsToolGatewayInstalled}
               setNodes={setNodes}
               memoryRef={memoryRef}
            />
          </div>
        );
      })}
    </>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  return content;
};

