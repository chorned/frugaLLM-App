import React from 'react';
import { TerminalView } from './TerminalView';
import { checkHermesStatus, checkOpencodeStatus, checkOllamaStatus, checkToolGatewayStatus } from '../services/tauri';

export interface TerminalOverlaysProps {
  terminalMode: string | null;
  activeProcesses: Record<string, boolean>;
  setTerminalMode: (mode: any) => void;
  setActiveProcesses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  frugalConfig: any;
  setFrugalConfig: any;
  setIsHermesInstalled: (installed: boolean) => void;
  setIsOpenCodeInstalled: (installed: boolean) => void;
  setIsOllamaInstalled: (installed: boolean) => void;
  setIsToolGatewayInstalled?: (installed: boolean) => void;
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
] as const;

export const TerminalOverlays: React.FC<TerminalOverlaysProps> = ({
  terminalMode,
  activeProcesses,
  setTerminalMode,
  setActiveProcesses,
  frugalConfig,
  setFrugalConfig,
  setIsHermesInstalled,
  setIsOpenCodeInstalled,
  setIsOllamaInstalled,
  setIsToolGatewayInstalled,
}) => {
  return (
    <>
      {TERMINAL_MODES.map((mode) => {
        const isActive = activeProcesses[mode] || terminalMode === mode;
        if (!isActive) return null;
        return (
          <div key={mode} style={{ display: terminalMode === mode ? 'flex' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 50, backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)' }}>
            <TerminalView
               mode={mode}
               sessionId={mode}
               onExit={() => {
                 setTerminalMode(null);
                 checkHermesStatus().then((installed) => setIsHermesInstalled(installed));
                 checkOpencodeStatus().then((installed) => setIsOpenCodeInstalled(installed));
                 checkOllamaStatus().then((installed) => setIsOllamaInstalled(installed));
                 checkToolGatewayStatus().then((installed) => setIsToolGatewayInstalled?.(installed));
               }}
               onProcessStart={() => setActiveProcesses(prev => ({ ...prev, [mode]: true }))}
               onProcessExit={() => setActiveProcesses(prev => ({ ...prev, [mode]: false }))}
               frugalConfig={frugalConfig}
               setFrugalConfig={setFrugalConfig}
               setIsHermesInstalled={setIsHermesInstalled}
               setIsOpenCodeInstalled={setIsOpenCodeInstalled}
               setIsOllamaInstalled={setIsOllamaInstalled}
               setIsToolGatewayInstalled={setIsToolGatewayInstalled}
            />
          </div>
        );
      })}
    </>
  );
};

