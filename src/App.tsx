import { useState, useEffect, useRef } from 'react';
import { TerminalLoader } from './components/TerminalLoader';
import { useCanvasLogic } from './hooks/useCanvasLogic';
import { useProxyActivityIndicator } from './hooks/useProxyActivityIndicator';
import { confirmExitApp } from './services/tauri';
import { MemoryProvider, useMemory } from './context/MemoryContext';
import { useOnboarding } from './hooks/useOnboarding';
import { useTheme } from './hooks/useTheme';
import { OnboardingDecision } from './components/OnboardingDecision';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { ExitConfirmationModal } from './components/ExitConfirmationModal';
import { IssueReporterModal } from './components/IssueReporterModal';
import { NodeConfigPanel } from './components/NodeConfigPanel';
import { TopologyCanvas } from './components/TopologyCanvas';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { TerminalOverlays } from './components/TerminalOverlays';
import { useTopologyWires } from './hooks/useTopologyWires';
import { useNodeActions } from './hooks/useNodeActions';
import { useAppEvents } from './hooks/useAppEvents';
import { runAppInit } from './services/appInit';
import { initialNodes } from './constants/canvas';
import { HardwareProfile } from './services/memoryCalculator';
import './App.css';


let isScreenshotMode = () => false;
let getScreenshotScreen = (): string | null => null;
let getScreenshotInitialNodes = (n: any[]) => n;
let APPSTORE_BOOT_LOGS: string[] = [];
let APPSTORE_FRUGAL_CONFIG: any = null;
let APPSTORE_TELEMETRY: any = null;

if (import.meta.env.DEV) {
  const mod = await import('./dev/screenshotMode');
  isScreenshotMode = mod.isScreenshotMode;
  getScreenshotScreen = mod.getScreenshotScreen;
  getScreenshotInitialNodes = mod.getScreenshotInitialNodes;
  APPSTORE_BOOT_LOGS = mod.APPSTORE_BOOT_LOGS;
  APPSTORE_FRUGAL_CONFIG = mod.APPSTORE_FRUGAL_CONFIG;
  APPSTORE_TELEMETRY = mod.APPSTORE_TELEMETRY;
}

function AppContent() {
  const memory = useMemory();
  const memoryRef = useRef(memory);
  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  const { onboardingState, handleDecision, isLoaded } = useOnboarding();
  const { theme, toggleTheme, isDark } = useTheme();
  const [nodes, setNodes] = useState(() => {
    if (import.meta.env.DEV && isScreenshotMode()) {
      return getScreenshotInitialNodes(initialNodes);
    }
    return initialNodes;
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) {
      const scr = getScreenshotScreen();
      if (scr && scr.startsWith('node-')) return scr;
    }
    return null;
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const centralNodeRef = useRef<HTMLDivElement | null>(null);
  const outerNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const {
    pan,
    zoom,
    containerSize,
    handleCanvasMouseDown,
    handleCanvasClick,
  } = useCanvasLogic(canvasRef, (_e, nodeId) => {
    setSelectedNodeId(nodeId);
  }, () => {
    setSelectedNodeId(null);
  });

  const [terminalMode, setTerminalMode] = useState<'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-gateway' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama' | 'install-tool-gateway' | 'uninstall-tool-gateway' | null>(null);
  const [isHermesInstalled, setIsHermesInstalled] = useState<boolean>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return false;
  });
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState<boolean>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return false;
  });
  const [hermesVersion, setHermesVersion] = useState<string>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return 'v0.4.2';
    return 'N/A';
  });
  const [opencodeVersion, setOpencodeVersion] = useState<string>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return 'v1.2.0';
    return 'N/A';
  });
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return false;
  });
  const [isToolGatewayInstalled, setIsToolGatewayInstalled] = useState<boolean>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return false;
  });

  const [isAppLoaded, setIsAppLoaded] = useState(() => {
    if (import.meta.env.DEV && isScreenshotMode()) {
      return getScreenshotScreen() !== 'boot';
    }
    return false;
  });
  const [initLogs, setInitLogs] = useState<string[]>(() => {
    if (import.meta.env.DEV && isScreenshotMode() && getScreenshotScreen() === 'boot') {
      return APPSTORE_BOOT_LOGS;
    }
    return [];
  });
  const [frugalConfig, setFrugalConfig] = useState<any>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return APPSTORE_FRUGAL_CONFIG;
    return null;
  });
  const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>((): Record<string, boolean> => {
    if (import.meta.env.DEV && isScreenshotMode()) {
      return {
        'run-hermes-gateway': true,
        'hermes-gateway': true,
        'run-hermes-desktop': true,
        'run-opencode-web': true,
      };
    }
    return {};
  });
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitServices, setExitServices] = useState<string[]>([]);
  const [isIssueReporterOpen, setIsIssueReporterOpen] = useState(false);
  const [latestTelemetry, setLatestTelemetry] = useState<any>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return APPSTORE_TELEMETRY;
    return null;
  });
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(null);
  const [detectedVram, setDetectedVram] = useState<number | string>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return '16';
    return '8';
  });
  const [portConflict, setPortConflict] = useState<{ port: number; message: string } | null>(null);
  const [daemonError, setDaemonError] = useState<string | null>(null);

  const { activeProxyState, handleProxyActivityEvent, cleanup: cleanupProxyIndicator } = useProxyActivityIndicator();

  // App Global Event Listeners Hook
  useAppEvents({
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
  });

  // Node Actions Hook
  const {
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
  } = useNodeActions({
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
  });

  // Topology Wires Hook
  const { lines, handleToggleTheme } = useTopologyWires({
    mainContainerRef,
    centralNodeRef,
    outerNodeRefs,
    nodes,
    portConflict,
    terminalMode,
    isAppLoaded,
    theme,
    activeProxyState,
    activeProcesses,
    toggleTheme,
  });

  useEffect(() => {
    let isMounted = true;
    if (import.meta.env.DEV && isScreenshotMode()) {
      if (getScreenshotScreen() === 'boot') {
        setInitLogs(APPSTORE_BOOT_LOGS);
        setIsAppLoaded(false);
        return;
      }
      setIsAppLoaded(true);
      return;
    }
    runAppInit({
      isMounted: () => isMounted,
      addLog: (msg: string) => {
        if (isMounted) setInitLogs(prev => [...prev, msg]);
      },
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
      setDaemonError,
      setIsAppLoaded,
    });
    return () => { isMounted = false; };
  }, []);

  // Viewport Hub Centering Mandate:
  // The central FrugaLLM node must be mathematically positioned such that its geometric center
  // (accounting for its true card height and width) coincides exactly with the viewport midpoint
  // (50% of inner window width, 50% of inner window height).
  const headerHeight = (headerRef.current && headerRef.current.offsetHeight > 0) ? headerRef.current.offsetHeight : 41;
  const currentViewportWidth = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : containerSize.width;
  const currentViewportHeight = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : (containerSize.height + headerHeight);
  const activeWidth = containerSize.width > 0 ? containerSize.width : currentViewportWidth;
  const activeHeight = containerSize.height > 0 ? containerSize.height : (currentViewportHeight - headerHeight);
  const autoScale = Math.min(activeWidth / 800, activeHeight / 600, 1);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  if (!isLoaded) return null;

  return !isAppLoaded ? <TerminalLoader logs={initLogs} theme={theme} /> : (
    <div 
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', fontFamily: 'inherit', backgroundColor: 'var(--zen-canvas)', backgroundImage: 'var(--zen-canvas-texture)', overflow: 'hidden', overscrollBehavior: 'none' }}
    >
      <Header
        headerRef={headerRef}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      <TerminalOverlays
        terminalMode={terminalMode}
        activeProcesses={activeProcesses}
        setTerminalMode={setTerminalMode}
        setActiveProcesses={setActiveProcesses}
        frugalConfig={frugalConfig}
        setFrugalConfig={setFrugalConfig}
        setIsHermesInstalled={setIsHermesInstalled}
        setIsOpenCodeInstalled={setIsOpenCodeInstalled}
        setIsOllamaInstalled={setIsOllamaInstalled}
        setIsToolGatewayInstalled={setIsToolGatewayInstalled}
      />

      <TopologyCanvas
        canvasRef={canvasRef}
        mainContainerRef={mainContainerRef}
        centralNodeRef={centralNodeRef}
        outerNodeRefs={outerNodeRefs}
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        terminalMode={terminalMode}
        portConflict={portConflict}
        frugalConfig={frugalConfig}
        isOllamaInstalled={isOllamaInstalled}
        setSelectedNodeId={setSelectedNodeId}
        setPortConflict={setPortConflict}
        handleCanvasClick={handleCanvasClick}
        handleCanvasMouseDown={handleCanvasMouseDown}
        handleNodeClick={handleNodeClick}
        autoScale={autoScale}
        pan={pan}
        zoom={zoom}
        lines={lines}
        activeProxyState={activeProxyState}
        isHermesInstalled={isHermesInstalled}
        isOpenCodeInstalled={isOpenCodeInstalled}
        activeProcesses={activeProcesses}
        hermesVersion={hermesVersion}
        opencodeVersion={opencodeVersion}
      />

      <Footer portConflict={portConflict} daemonError={daemonError} />

      {selectedNode && !terminalMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedNodeId(null)}>
          <NodeConfigPanel 
            node={selectedNode} 
            onClose={() => setSelectedNodeId(null)} 
            onSave={handleSaveNodeConfig} 
            onOpenIssueReporter={() => setIsIssueReporterOpen(true)}
            isHermesInstalled={isHermesInstalled} 
            isOpenCodeInstalled={isOpenCodeInstalled} 
            isOllamaInstalled={isOllamaInstalled} 
            isToolGatewayInstalled={isToolGatewayInstalled} 
            detectedVram={detectedVram}
            setDetectedVram={setDetectedVram}
            hasActiveBackend={nodes.some(n => (n.id === 'node-ollama' || n.id === 'node-openrouter' || n.id === 'node-google') && n.data.status === 'active')}
            handleInitializeHermes={handleInitializeHermes} 
            handleUninstallHermes={handleUninstallHermes} 
            handleOpenHermes={handleOpenHermes} 
            handleInitializeOpenCode={handleInitializeOpenCode} 
            handleUninstallOpenCode={handleUninstallOpenCode} 
            handleOpenOpenCode={handleOpenOpenCode} 
            handleInitializeOllama={handleInitializeOllama} 
            handleOpenOllama={handleOpenOllama} 
            handleUninstallOllama={handleUninstallOllama} 
            handleInstallToolGateway={handleInstallToolGateway} 
            handleUninstallToolGateway={handleUninstallToolGateway} 
            handleDisconnectOpenRouter={handleDisconnectOpenRouter} 
            handleDisconnectGoogle={handleDisconnectGoogle} 
            frugalConfig={frugalConfig} 
            setFrugalConfig={setFrugalConfig} 
            handleOpenHermesGateway={handleOpenHermesGateway} 
            handleOpenHermesDesktop={handleOpenHermesDesktop} 
            handleOpenHermesWeb={handleOpenHermesWeb} 
            handleOpenOpenCodeWeb={handleOpenOpenCodeWeb} 
            activeProcesses={activeProcesses} 
            handleKillProcess={handleKillProcess} 
            latestTelemetry={latestTelemetry} 
            hardwareProfile={hardwareProfile} 
            portConflict={Boolean(portConflict)} 
          />
        </div>
      )}

      <ExitConfirmationModal
        isOpen={showExitModal}
        onCancel={() => setShowExitModal(false)}
        onConfirm={() => {
          confirmExitApp().catch(console.error);
        }}
        activeServices={exitServices}
      />

      <IssueReporterModal
        isOpen={isIssueReporterOpen}
        onClose={() => setIsIssueReporterOpen(false)}
      />

      {onboardingState === 'fresh' && (
        <OnboardingDecision onSelect={handleDecision} />
      )}

      {onboardingState === 'learning' && (
        <OnboardingOverlay
          onComplete={() => handleDecision('completed')}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <MemoryProvider>
      <AppContent />
    </MemoryProvider>
  );
}
