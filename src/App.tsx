import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TerminalLoader } from './components/TerminalLoader';
import { useCanvasLogic } from './hooks/useCanvasLogic';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { Store } from '@tauri-apps/plugin-store';
import { Settings } from './components/Settings';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { listen } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { openUrl } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import ReactMarkdown from 'react-markdown';
import { StatusLight, InfoField, HardwareNode } from './components/NodeWidgets';
import { MemoryPipelineWidget } from './components/MemoryPipelineWidget';
import { MemoryProvider, useMemory } from './context/MemoryContext';
import { HardwareProfile, AVAILABLE_MODELS, GRAPH_OVERHEAD_GB } from './services/memoryCalculator';
import { CloudRoutingPanel } from './components/CloudRoutingPanel';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingDecision } from './components/OnboardingDecision';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { PortConflictBanner } from './components/PortConflictBanner';
import { ExitConfirmationModal } from './components/ExitConfirmationModal';
import en from './locales/en.json';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { loadOnnxClassifier, clearOnnxCache } from './services/onnxGateway';
import agentsGuide from './guides/agents.md?raw';
import ollamaGuide from './guides/ollama.md?raw';
import openrouterGuide from './guides/openrouter.md?raw';

const GUIDES_MAP: Record<string, string> = {
  agents: agentsGuide,
  ollama: ollamaGuide,
  openrouter: openrouterGuide
};


const NODE_WIDTH = 220;
const NODE_HEIGHT = 130;

const nodeLayout: Record<string, { rx: number, ry: number }> = {
  'node-frugallm': { rx: 0, ry: 0 },
  'node-ollama': { rx: -0.35, ry: -0.25 },
  'node-google': { rx: 0, ry: -0.25 },
  'node-openrouter': { rx: 0.35, ry: -0.25 },
  'node-opencode': { rx: -0.25, ry: 0.25 },
  'node-hermes': { rx: 0.25, ry: 0.25 }
};


type NodeData = {
  label: string;
  subheader?: string;
  description: string;
  ip?: string;
  port?: string;
  status: string;
  schemaPath?: string;
  cwd?: string;
  bin?: string;
  extraArgs?: string;
  prompt?: string;
  isAgent?: boolean;
  isGenerating?: boolean;
  isHardware?: boolean;
  isCloud?: boolean;
  keyPrefix?: string;
  lastStatus?: string;
};

type AppNode = {
  id: string;
  x: number;
  y: number;
  data: NodeData;
};

const initialNodes: AppNode[] = [
  {
    id: 'node-ollama',
    x: 50, y: 50,
    data: { 
      label: 'Ollama',
      subheader: 'Open source', 
      description: 'Your private, local brain! Ollama runs lightweight open-source models right on your machine, keeping your data entirely private and free from cloud costs.',
      ip: '127.0.0.1', 
      port: '11434',
      status: 'needs_activation'
    }
  },
  {
    id: 'node-openrouter',
    x: 750, y: 50,
    data: {
      label: 'Openrouter',
      subheader: 'Stripe (cloud)',
      description: '',
      ip: 'openrouter.ai',
      status: 'needs_activation'
    }
  },
  {
    id: 'node-google',
    x: 400, y: 50,
    data: {
      label: 'AI Studio',
      subheader: 'Google (cloud)',
      description: '',
      ip: 'generativelanguage.googleapis.com',
      status: 'needs_activation'
    }
  },
  {
    id: 'node-frugallm',
    x: 400, y: 250,
    data: { 
      label: 'FrugaLLM',
      subheader: 'Open source',
      description: '',
      ip: '127.0.0.1', 
      port: '8080',
      status: 'active'
    }
  },
  {
    id: 'node-opencode',
    x: 150, y: 500,
    data: { 
      label: 'Opencode',
      subheader: 'Open source',
      description: '',
      ip: '127.0.0.1', 
      port: '3000',
      status: 'inactive'
    }
  },
  {
    id: 'node-hermes',
    x: 650, y: 500,
    data: { 
      label: 'Hermes',
      subheader: 'Open source',
      description: '',
      ip: '127.0.0.1', 
      port: '3001',
      status: 'inactive'
    }
  }
];

const initialEdges = [
  { id: 'edge-frugallm-ollama', source: 'node-frugallm', target: 'node-ollama' },
  { id: 'edge-frugallm-openrouter', source: 'node-frugallm', target: 'node-openrouter' },
  { id: 'edge-frugallm-google', source: 'node-frugallm', target: 'node-google' },
  { id: 'edge-opencode-frugallm', source: 'node-opencode', target: 'node-frugallm' },
  { id: 'edge-hermes-frugallm', source: 'node-hermes', target: 'node-frugallm' },
];

const Icons = {
  cpu: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>,
  cloud: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>,
  terminal: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>,
  code: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>,
  workflow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"></rect><rect x="15" y="3" width="6" height="6" rx="1"></rect><rect x="9" y="15" width="6" height="6" rx="1"></rect><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"></path><path d="M12 13v2"></path></svg>,
  agent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"></path><path d="M19 15v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1"></path><path d="M5 22v-3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"></path></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  info: <svg viewBox="-50 -50 590 590" width="14" height="14" style={{ display: 'block' }} fill="currentColor"><path d="M245.148,0C109.967,0,0.009,109.98,0.009,245.162c0,135.182,109.958,245.156,245.139,245.156 c135.186,0,245.162-109.978,245.162-245.156C490.31,109.98,380.333,0,245.148,0z M245.148,438.415 c-106.555,0-193.234-86.698-193.234-193.253c0-106.555,86.68-193.258,193.234-193.258c106.559,0,193.258,86.703,193.258,193.258 C438.406,351.717,351.706,438.415,245.148,438.415z"/><path d="M270.036,221.352h-49.771c-8.351,0-15.131,6.78-15.131,15.118v147.566c0,8.352,6.78,15.119,15.131,15.119h49.771 c8.351,0,15.131-6.77,15.131-15.119V236.471C285.167,228.133,278.387,221.352,270.036,221.352z"/><path d="M245.148,91.168c-24.48,0-44.336,19.855-44.336,44.336c0,24.484,19.855,44.34,44.336,44.34 c24.485,0,44.342-19.855,44.342-44.34C289.489,111.023,269.634,91.168,245.148,91.168z"/></svg>
};

const Tooltip = ({ text }: { text: string }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, isAbove: true });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isAbove = rect.top > 90;
      setCoords({
        top: isAbove ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
        isAbove
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setVisible(true);
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [visible]);

  return (
    <>
      <span 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '14px', 
          height: '14px', 
          color: '#9ca3af', 
          marginLeft: '6px', 
          cursor: 'help' 
        }}
      >
        {Icons.info}
      </span>
      {visible && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: coords.isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 999999,
            pointerEvents: 'none',
            width: 'max-content',
            maxWidth: '260px',
            backgroundColor: '#111827',
            color: '#ffffff',
            textAlign: 'center',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.75rem',
            fontFamily: 'sans-serif',
            fontWeight: 'normal',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)',
            lineHeight: 1.35,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textTransform: 'none'
          }}
        >
          {text}
          <div 
            style={{
              position: 'absolute',
              ...(coords.isAbove 
                ? { top: '100%', borderColor: '#111827 transparent transparent transparent' } 
                : { bottom: '100%', borderColor: 'transparent transparent #111827 transparent' }),
              left: '50%',
              transform: 'translateX(-50%)',
              borderWidth: '5px',
              borderStyle: 'solid',
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};

const NodeConfigPanel = ({ node, onClose, onSave, isHermesInstalled, isOpenCodeInstalled, isOllamaInstalled, isToolGatewayInstalled, detectedVram, setDetectedVram, hasActiveBackend, handleInitializeHermes, handleOpenHermes, handleUninstallHermes, handleInitializeOpenCode, handleOpenOpenCode, handleUninstallOpenCode, handleInitializeOllama, handleOpenOllama, handleUninstallOllama, handleInstallToolGateway, handleUninstallToolGateway, handleDisconnectOpenRouter, handleDisconnectGoogle, frugalConfig, handleOpenHermesGateway, handleOpenHermesDesktop, handleOpenHermesWeb, handleOpenOpenCodeWeb, activeProcesses, handleKillProcess, setFrugalConfig, latestTelemetry, hardwareProfile, portConflict }: any) => {
  const memory = useMemory();
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [showToolGatewayPrompt, setShowToolGatewayPrompt] = useState<'install' | 'uninstall' | null>(null);
  const [ipCopied, setIpCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [initialEnablePassword, setInitialEnablePassword] = useState<boolean>(false);

  useEffect(() => {
    const vramNum = Number(detectedVram) || 0;
    if (vramNum > 0) {
      memory.setDetectedVramGb(vramNum);
      invoke<string>('get_model_tag_for_vram', { detectedVramGb: vramNum })
        .then((tag) => {
          if (tag) memory.setActiveModelName(tag);
        })
        .catch(() => {});
    }
  }, [detectedVram]);
  
  const [formData, setFormData] = useState({
    ip: node.data.ip || '',
    port: node.data.port || '',
    status: node.data.status || 'active',
    schemaPath: node.data.schemaPath || '',
    cwd: node.data.cwd || '',
    bin: node.data.bin || '',
    extraArgs: node.data.extraArgs || '',
    prompt: node.data.prompt || '',
    apiKey: '',
    googleApiKey: '',
    bind_all_interfaces: false,
    api_password: '',
    hermes_workspace: frugalConfig?.hermes_workspace || '',
    opencode_workspace: frugalConfig?.opencode_workspace || '',
    start_on_login: false,
    start_minimized: frugalConfig?.start_minimized || false
  });

  useEffect(() => {
    if (node.id === 'node-frugallm') {
      const hasPass = Boolean(frugalConfig?.api_password);
      setEnablePassword(hasPass);
      setInitialEnablePassword(hasPass);
      setShowPassword(false);
      setPasswordCopied(false);
      const initFrugal = {
        port: frugalConfig?.port?.toString() || '0',
        bind_all_interfaces: frugalConfig?.bind_all_interfaces || false,
        api_password: frugalConfig?.api_password || '',
        start_minimized: frugalConfig?.start_minimized || false,
        start_on_login: false,
      };
      setFormData(prev => ({
        ...prev,
        ...initFrugal
      }));
      setInitialData(initFrugal);
      isAutostartEnabled()
        .then(enabled => {
          setFormData(prev => ({ ...prev, start_on_login: enabled }));
          setInitialData((prevInit: any) => ({ ...(prevInit || initFrugal), start_on_login: enabled }));
        })
        .catch(() => {});
    } else {
      const initOther = { 
        ip: node.data.ip || '', 
        port: node.data.port || '', 
        status: node.data.status || 'active',
        schemaPath: node.data.schemaPath || '',
        cwd: node.data.cwd || '',
        bin: node.data.bin || '',
        extraArgs: node.data.extraArgs || '',
        prompt: node.data.prompt || '',
        apiKey: '',
        googleApiKey: '',
        bind_all_interfaces: false,
        api_password: '',
        hermes_workspace: frugalConfig?.hermes_workspace || '~/Hermes',
        opencode_workspace: frugalConfig?.opencode_workspace || '~/Opencode',
        start_on_login: false,
        start_minimized: frugalConfig?.start_minimized || false
      };
      setFormData(initOther);
      setInitialData(initOther);
    }
  }, [node, frugalConfig]);

  const hasChanges = (() => {
    if (!initialData) return false;

    if (node.id === 'node-frugallm') {
      const portChanged = String(formData.port || '') !== String(initialData.port || '');
      const bindChanged = Boolean(formData.bind_all_interfaces) !== Boolean(initialData.bind_all_interfaces);
      const enablePassChanged = enablePassword !== initialEnablePassword;
      const passChanged = enablePassword ? (formData.api_password || '') !== (initialData.api_password || '') : false;
      const autostartChanged = Boolean(formData.start_on_login) !== Boolean(initialData.start_on_login);
      const minimizedChanged = Boolean(formData.start_minimized) !== Boolean(initialData.start_minimized);
      return portChanged || bindChanged || enablePassChanged || passChanged || autostartChanged || minimizedChanged;
    }

    if (node.id === 'node-openrouter') {
      return Boolean(formData.apiKey && formData.apiKey.trim().length > 0);
    }

    if (node.id === 'node-google') {
      return Boolean(formData.googleApiKey && formData.googleApiKey.trim().length > 0);
    }

    if (node.id === 'node-hermes') {
      if (!isHermesInstalled) return false;
      return (formData.hermes_workspace || '') !== (initialData.hermes_workspace || '');
    }

    if (node.id === 'node-opencode') {
      if (!isOpenCodeInstalled) return false;
      return (formData.opencode_workspace || '') !== (initialData.opencode_workspace || '');
    }

    if (node.data?.isAgent) {
      return (
        (formData.schemaPath || '') !== (initialData.schemaPath || '') ||
        (formData.cwd || '') !== (initialData.cwd || '') ||
        (formData.bin || '') !== (initialData.bin || '') ||
        (formData.extraArgs || '') !== (initialData.extraArgs || '') ||
        (formData.prompt || '') !== (initialData.prompt || '')
      );
    }

    // Generic / other nodes (e.g. node-ollama)
    return (
      (formData.ip || '') !== (initialData.ip || '') ||
      String(formData.port || '') !== String(initialData.port || '')
    );
  })();

  const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSave = async () => {
    if (!hasChanges) return;
    if (node.id === 'node-frugallm') {
      try {
        if (formData.start_on_login) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }
      } catch (err) {
        console.warn('Failed to update autostart setting:', err);
      }
      try {
        const store = await Store.load('store.json');
        await store.set('start_minimized', Boolean(formData.start_minimized));
        await store.save();
      } catch (err) {
        console.warn('Failed to save start_minimized to store:', err);
      }
    }
    const dataToSave = {
      ...formData,
      api_password: enablePassword ? formData.api_password : ''
    };
    onSave(node.id, dataToSave);
    setInitialData({ ...formData });
    setInitialEnablePassword(enablePassword);
  };
  
  const handlePanelClick = (e: any) => e.stopPropagation();

  return (
    <div onClick={handlePanelClick} style={{ 
      width: '400px', 
      maxHeight: '85vh',
      border: '1px solid var(--zen-border)', backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', borderRadius: '12px',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 48px rgba(0, 0, 0, 0.1)', overflow: 'hidden',
      zIndex: 100,
      fontFamily: 'inherit'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', borderBottom: '1px solid var(--zen-border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2 style={{ margin: 0, color: 'var(--zen-text)', fontSize: '1rem', fontWeight: 700 }}>{node.data.label}</h2>
          {node.data.subheader && (
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--zen-text-secondary)' }}>
              ({node.data.subheader})
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#9ca3af', padding: '2px 6px' }}>✕</button>
      </div>
      
      <div style={{ padding: '14px 16px', flexGrow: 1, backgroundColor: 'transparent', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {node.data.isAgent ? (
            <>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>SCHEMA PATH <Tooltip text="Think of this as the agent's strict instruction manual. By giving it a JSON schema, we force the AI to return data in the exact structure your application expects. No more messy text—just clean data!" /></label>
                <input type="text" name="schemaPath" value={formData.schemaPath} onChange={handleChange} 
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>WORKING DIR (CWD) <Tooltip text="Where should the agent live while it works? This is the folder on your computer where the agent will run commands and look for files. It's basically the agent's home base." /></label>
                <input type="text" name="cwd" value={formData.cwd} onChange={handleChange} 
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>EXECUTABLE (BIN) <Tooltip text="Which program is actually doing the heavy lifting? This tells the system what tool to launch under the hood. Usually, it's 'agy' for our Antigravity agent, but you can plug in any CLI tool!" /></label>
                <input type="text" name="bin" value={formData.bin} onChange={handleChange} 
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>EXTRA ARGS (CSV) <Tooltip text="Want to tweak how the agent runs? You can pass secret flags here (like '--verbose' to see its inner thoughts). Just list them out, separated by commas." /></label>
                <input type="text" name="extraArgs" value={formData.extraArgs} onChange={handleChange} placeholder="--verbose, --force"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>INSTRUCTION PROMPT <Tooltip text="This is your agent's main mission. Tell it exactly what you want it to accomplish. Be as specific as possible—the better the prompt, the better the results!" /></label>
                <textarea name="prompt" value={formData.prompt} onChange={handleChange} rows={2} 
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
              </div>
            </>
          ) : (
            <>
              {node.id !== 'node-openrouter' && node.id !== 'node-google' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 95px', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>IP ADDRESS / HOST <Tooltip text="Where does this service live on the network? Usually, it's right here on your computer ('127.0.0.1' or 'localhost'), but it could be a cloud API halfway across the world!" /></label>
                    {node.id === 'node-frugallm' || node.id === 'node-hermes' || node.id === 'node-opencode' ? (
                      <div style={{ padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: 'var(--zen-surface-hover)', color: '#4b5563', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>
                        {node.id === 'node-frugallm' ? (formData.bind_all_interfaces ? '0.0.0.0' : '127.0.0.1') : formData.ip}
                      </div>
                    ) : (
                      <input type="text" name="ip" value={formData.ip} onChange={handleChange} 
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                    {node.id === 'node-hermes' || node.id === 'node-opencode' ? (
                      <div style={{ padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: 'var(--zen-surface-hover)', color: '#4b5563', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>
                        {formData.port}
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        name="port" 
                        data-testid={node.id === 'node-frugallm' ? 'input-frugallm-port' : 'input-port'}
                        value={formData.port} 
                        onChange={handleChange} 
                        style={{ 
                          width: '100%', 
                          padding: '7px 10px', 
                          border: portConflict && node.id === 'node-frugallm' ? '2px solid #ef4444' : '1px solid var(--zen-border)', 
                          borderRadius: '6px', 
                          backgroundColor: '#ffffff', 
                          color: 'var(--zen-text)', 
                          outline: 'none', 
                          boxSizing: 'border-box', 
                          fontFamily: 'inherit', 
                          fontWeight: 600, 
                          fontSize: '0.85rem', 
                          boxShadow: 'none' 
                        }} 
                      />
                    )}
                    {portConflict && node.id === 'node-frugallm' && (
                      <div data-testid="port-conflict-hint" style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, marginTop: '4px', lineHeight: 1.2 }}>
                        Port {portConflict.port} in use: Close conflicting service and restart, or enter a new port.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {node.id === 'node-frugallm' && (
                <>
                  <button 
                    onClick={async () => {
                       try {
                         await writeText(`http://${formData.bind_all_interfaces ? '0.0.0.0' : '127.0.0.1'}:${formData.port}`);
                         setIpCopied(true);
                         setTimeout(() => setIpCopied(false), 1500);
                       } catch (err) {
                         console.error('Clipboard write failed:', err);
                       }
                    }}
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: ipCopied ? '#059669' : 'var(--zen-accent)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    {ipCopied ? '✓ OK' : 'COPY IP & PORT'}
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                      <input 
                        type="checkbox" 
                        name="bind_all_interfaces" 
                        checked={formData.bind_all_interfaces} 
                        onChange={(e) => setFormData(prev => ({ ...prev, bind_all_interfaces: e.target.checked }))} 
                      />
                      {en.routingGraph.nodeConfigPanel.inputs.bindAllInterfaces.label}
                      <Tooltip text={en.routingGraph.nodeConfigPanel.inputs.bindAllInterfaces.helpText} />
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                        <input 
                          type="checkbox" 
                          name="enable_api_password"
                          data-testid="api-password-checkbox"
                          checked={enablePassword} 
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEnablePassword(checked);
                            if (!checked) {
                              setFormData(prev => ({ ...prev, api_password: '' }));
                            }
                          }} 
                        />
                        {en.routingGraph.nodeConfigPanel.inputs.apiPassword.checkboxLabel}
                        <Tooltip text={en.routingGraph.nodeConfigPanel.inputs.apiPassword.helpText} />
                      </label>
                      {enablePassword && formData.api_password && (
                        <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>
                          {en.routingGraph.nodeConfigPanel.inputs.apiPassword.active}
                        </span>
                      )}
                    </div>

                    {enablePassword && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <input 
                          type={showPassword ? "text" : "password"} 
                          name="api_password" 
                          data-testid="api-password-input"
                          value={formData.api_password} 
                          onChange={handleChange} 
                          placeholder={en.routingGraph.nodeConfigPanel.inputs.apiPassword.placeholder}
                          style={{ 
                            flex: 1, 
                            padding: '7px 10px', 
                            border: '1px solid var(--zen-border)', 
                            borderRadius: '6px', 
                            backgroundColor: '#ffffff', 
                            color: 'var(--zen-text)', 
                            outline: 'none', 
                            boxSizing: 'border-box', 
                            fontFamily: 'inherit', 
                            fontWeight: 600, 
                            fontSize: '0.85rem',
                            boxShadow: 'none' 
                          }} 
                        />
                        <button
                          type="button"
                          data-testid="toggle-password-visibility"
                          onClick={() => setShowPassword(prev => !prev)}
                          title={showPassword ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.hide : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.show}
                          aria-label={showPassword ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.hide : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.show}
                          style={{
                            padding: '7px 10px',
                            backgroundColor: 'var(--zen-surface-hover)',
                            color: 'var(--zen-text)',
                            border: '1px solid var(--zen-border)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'inherit'
                          }}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button
                          type="button"
                          data-testid="copy-password-button"
                          disabled={!formData.api_password}
                          onClick={async () => {
                            if (!formData.api_password) return;
                            try {
                              await writeText(formData.api_password);
                              setPasswordCopied(true);
                              setTimeout(() => setPasswordCopied(false), 1500);
                            } catch (err) {
                              console.error('Clipboard write failed:', err);
                            }
                          }}
                          title={passwordCopied ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copied : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copy}
                          aria-label={passwordCopied ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copied : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copy}
                          style={{
                            padding: '7px 10px',
                            backgroundColor: passwordCopied ? '#059669' : 'var(--zen-surface-hover)',
                            color: passwordCopied ? '#ffffff' : 'var(--zen-text)',
                            border: '1px solid var(--zen-border)',
                            borderRadius: '6px',
                            cursor: formData.api_password ? 'pointer' : 'not-allowed',
                            opacity: formData.api_password ? 1 : 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s'
                          }}
                        >
                          {passwordCopied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '6px' }}>
                    <Settings
                      startOnLogin={formData.start_on_login}
                      onStartOnLoginChange={(enabled) => setFormData(prev => ({ ...prev, start_on_login: enabled }))}
                      startMinimized={formData.start_minimized}
                      onStartMinimizedChange={(minimized) => setFormData(prev => ({ ...prev, start_minimized: minimized }))}
                    />
                  </div>

                  <div style={{ marginTop: '4px' }}>
                    <CloudRoutingPanel />
                  </div>
                </>
              )}
              {node.id === 'node-openrouter' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>API KEY <Tooltip text="Your OpenRouter API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="apiKey" value={formData.apiKey || ''} onChange={handleChange} placeholder={node.data.status === 'active' ? en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.configuredPlaceholder : en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.placeholder}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
                </div>
              )}
              {node.id === 'node-google' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>API KEY <Tooltip text="Your Google AI Studio API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="googleApiKey" value={formData.googleApiKey || ''} onChange={handleChange} placeholder={node.data.status === 'active' ? en.routingGraph.nodeConfigPanel.inputs.googleApiKey.configuredPlaceholder : en.routingGraph.nodeConfigPanel.inputs.googleApiKey.placeholder}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', boxShadow: 'none' }} />
                </div>
              )}
            </>
          )}
          
        </div>
        
        {node.data.description && node.id !== 'node-ollama' ? (
          <p style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '12px', marginBottom: '0', lineHeight: 1.35, fontFamily: 'sans-serif', borderTop: '1px dashed #d1d5db', paddingTop: '10px' }}>
            {node.data.description}
          </p>
        ) : null}

      {node.id === 'node-hermes' && isHermesInstalled === false && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--zen-text)', margin: 0, fontWeight: 600 }}>Please connect an intelligence source to FrugaLLM first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeHermes(); }}
              style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              INSTALL HERMES
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-hermes' && isHermesInstalled === true && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--zen-text)', fontSize: '0.8rem' }}>HERMES AGENT INSTALLED</h4>
          {confirmUninstall === 'hermes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallHermes(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid var(--zen-border)', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="hermes_workspace" value={formData.hermes_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenHermes(); }}
                style={{ width: '100%', padding: '9px 12px', backgroundColor: '#16a34a', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH HERMES
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); (handleOpenHermesDesktop || handleOpenHermesGateway)(); }}
                  style={{ flex: 1, padding: '6px 8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                  LAUNCH APP
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenHermesWeb(); }}
                  style={{ flex: 1, padding: '6px 8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                  LAUNCH WEBUI
                </button>
              </div>
              {(() => {
                const hermesModes: { key: string; label: string; mode: string }[] = [];
                if (activeProcesses['run-hermes-gateway'] || activeProcesses['hermes-gateway']) {
                  hermesModes.push({ key: 'hermes-gateway', label: 'HERMES GATEWAY ACTIVE', mode: 'run-hermes-gateway' });
                }
                if (activeProcesses['run-hermes-desktop'] || activeProcesses['run-hermes-app']) {
                  hermesModes.push({ key: 'hermes-desktop', label: 'HERMES APP ACTIVE', mode: 'run-hermes-desktop' });
                }
                if (activeProcesses['run-hermes-web'] || activeProcesses['hermes-dashboard'] || activeProcesses['hermes-web']) {
                  hermesModes.push({ key: 'hermes-web', label: 'HERMES WEBUI ACTIVE', mode: 'run-hermes-web' });
                }
                if (activeProcesses['run-hermes']) {
                  hermesModes.push({ key: 'hermes-cli', label: 'HERMES CLI ACTIVE', mode: 'run-hermes' });
                }
                return hermesModes.map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--zen-text)', fontWeight: 700, fontSize: '0.75rem' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', boxShadow: '0 0 4px #16a34a' }} />
                      {item.label}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleKillProcess(item.mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>CLOSE</button>
                  </div>
                ));
              })()}
              <button 
                onClick={(e) => { e.stopPropagation(); invoke('edit_hermes_soul').catch(console.error); }}
                style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '6px', color: '#374151', border: '1px solid #d1d5db', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                EDIT SOUL.MD
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('hermes'); }}
                style={{ width: '100%', padding: '6px 8px', backgroundColor: 'transparent', color: '#ef4444', border: '1px dashed #ef4444', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL HERMES
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-opencode' && isOpenCodeInstalled === false && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--zen-text)', margin: 0, fontWeight: 600 }}>Please connect an intelligence source to FrugaLLM first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeOpenCode(); }}
              style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              INSTALL OPENCODE
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-opencode' && isOpenCodeInstalled === true && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--zen-text)', fontSize: '0.8rem' }}>OPENCODE AGENT INSTALLED</h4>
          {confirmUninstall === 'opencode' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOpenCode(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid var(--zen-border)', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '3px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="opencode_workspace" value={formData.opencode_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCode(); }}
                style={{ width: '100%', padding: '9px 12px', backgroundColor: '#16a34a', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH OPENCODE
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCodeWeb(); }}
                style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                LAUNCH WEBUI
              </button>
              {['run-opencode', 'run-opencode-web'].map(mode => activeProcesses && activeProcesses[mode] && (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px', marginBottom: '4px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--zen-text)', fontWeight: 700, fontSize: '0.75rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', boxShadow: '0 0 4px #16a34a' }} />
                    {mode.replace('run-', '').toUpperCase()} ACTIVE
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleKillProcess(mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>CLOSE</button>
                </div>
              ))}
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('opencode'); }}
                style={{ width: '100%', padding: '6px 8px', backgroundColor: 'transparent', color: '#ef4444', border: '1px dashed #ef4444', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL OPENCODE
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-ollama' && isOllamaInstalled === false && (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '4px' }}>VRAM DETECTED (GB) <Tooltip text="We tried to auto-detect your Video RAM, but you can correct this if it's wrong." /></label>
            <input 
              type="text" 
              value={detectedVram} 
              onChange={(e) => {
                setDetectedVram(e.target.value);
                const num = Number(e.target.value) || 0;
                if (num > 0) memory.setDetectedVramGb(num);
              }}
              data-testid="vram-detected-input"
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }} 
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '4px' }}>RECOMMENDED MODEL <Tooltip text="Based on your VRAM, we'll pull this model for you!" /></label>
            <select 
              value={memory.activeModelName} 
              onChange={(e) => memory.setActiveModelName(e.target.value)}
              data-testid="recommended-model-input"
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--zen-border)', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7F99' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '30px' }} 
            >
              {AVAILABLE_MODELS.map((model) => {
                const totalGb = (model.weightsGb + model.kvCacheGb + GRAPH_OVERHEAD_GB).toFixed(1);
                return (
                  <option key={model.tag} value={model.tag}>
                    • {model.tag} ({totalGb} GB)
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <MemoryPipelineWidget 
              modelTag={memory.activeModelName} 
              segments={memory.effectiveSegments} 
              hardwareProfile={hardwareProfile || memory.hardwareProfile || latestTelemetry?.hardware_profile} 
            />
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); handleInitializeOllama(); }}
            style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'background-color 0.15s' }}>
            INSTALL OLLAMA
          </button>
        </div>
      )}
      
      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--zen-text)', fontSize: '0.8rem' }}>OLLAMA INSTALLED</h4>
          
          <div style={{ marginBottom: '12px' }}>
            <MemoryPipelineWidget 
              modelTag={latestTelemetry?.ollama?.model_name || memory.activeModelName} 
              segments={memory.effectiveSegments} 
              hardwareProfile={hardwareProfile || memory.hardwareProfile || latestTelemetry?.hardware_profile} 
            />
          </div>

          {confirmUninstall === 'ollama' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOllama(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid var(--zen-border)', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOllama(); }}
                style={{ width: '100%', padding: '9px 12px', backgroundColor: '#16a34a', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                CHAT WITH OLLAMA
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('ollama'); }}
                style={{ width: '100%', padding: '6px 8px', backgroundColor: 'transparent', color: '#ef4444', border: '1px dashed #ef4444', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL OLLAMA
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h4 style={{ margin: 0, color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.5px' }}>
              {en.routingGraph.nodeConfigPanel.actions.toolGateway.title}
            </h4>
            <span 
              data-testid="tool-gateway-status"
              style={{ 
              fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
              backgroundColor: isToolGatewayInstalled ? '#dcfce7' : '#f3f4f6',
              color: isToolGatewayInstalled ? '#15803d' : '#6b7280',
              border: `1px solid ${isToolGatewayInstalled ? '#86efac' : '#d1d5db'}`
            }}>
              {isToolGatewayInstalled ? en.routingGraph.nodeConfigPanel.actions.toolGateway.installed : en.routingGraph.nodeConfigPanel.actions.toolGateway.notInstalled}
            </span>
          </div>

          <p style={{ margin: '0 0 8px 0', fontSize: '0.7rem', color: 'var(--zen-text-secondary)', lineHeight: '1.3' }}>
            {en.routingGraph.nodeConfigPanel.actions.toolGateway.description}
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox"
              name="toolGatewayCheckbox"
              data-testid="tool-gateway-checkbox"
              checked={!!frugalConfig?.tool_enforcing_gateway}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked) {
                  if (!isToolGatewayInstalled) {
                    setShowToolGatewayPrompt('install');
                  } else {
                    const next = { ...frugalConfig, tool_enforcing_gateway: true };
                    if (setFrugalConfig) setFrugalConfig(next);
                    invoke('set_frugallm_config', { config: next }).catch(console.error);
                  }
                } else {
                  if (isToolGatewayInstalled) {
                    setShowToolGatewayPrompt('uninstall');
                  } else {
                    const next = { ...frugalConfig, tool_enforcing_gateway: false };
                    if (setFrugalConfig) setFrugalConfig(next);
                    invoke('set_frugallm_config', { config: next }).catch(console.error);
                  }
                }
              }}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--zen-text)' }}>
              {en.routingGraph.nodeConfigPanel.actions.toolGateway.checkboxLabel}
            </span>
          </label>

          {showToolGatewayPrompt === 'install' && (
            <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 700 }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.installPromptTitle}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#9a3412', lineHeight: '1.3' }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.installPromptText}
              </span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                <button 
                  data-testid="confirm-install-tool-gateway"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                    handleInstallToolGateway();
                  }}
                  style={{ flex: 1, padding: '6px', backgroundColor: 'var(--zen-accent)', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.installButton}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                  }}
                  style={{ flex: 1, padding: '6px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.cancelButton}
                </button>
              </div>
            </div>
          )}

          {showToolGatewayPrompt === 'uninstall' && (
            <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700 }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallPromptTitle}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#991b1b', lineHeight: '1.3' }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallPromptText}
              </span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                <button 
                  data-testid="confirm-uninstall-tool-gateway"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                    handleUninstallToolGateway();
                  }}
                  style={{ flex: 1, padding: '6px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallButton}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                  }}
                  style={{ flex: 1, padding: '6px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.cancelButton}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {node.id === 'node-openrouter' && node.data.status === 'active' && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--zen-text)', fontSize: '0.8rem' }}>OPENROUTER CONNECTED</h4>
          {confirmUninstall === 'openrouter' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectOpenRouter(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#ef4444', color: '#FFFFFF', border: '2px solid #991b1b', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('openrouter'); }}
                style={{ width: '100%', padding: '6px 8px', backgroundColor: 'transparent', color: '#ef4444', border: '1px dashed #ef4444', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-google' && node.data.status === 'active' && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--zen-text)', fontSize: '0.8rem' }}>GOOGLE AI STUDIO CONNECTED</h4>
          {confirmUninstall === 'google' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectGoogle(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#ef4444', color: '#FFFFFF', border: '2px solid #991b1b', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '6px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('google'); }}
                style={{ width: '100%', padding: '6px 8px', backgroundColor: 'transparent', color: '#ef4444', border: '1px dashed #ef4444', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}
      </div>
      
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--zen-border)', backgroundColor: '#ffffff', display: 'flex', gap: '8px' }}>
        <button 
          onClick={handleSave} 
          disabled={!hasChanges}
          data-testid="save-node-config-button"
          style={{ 
            flex: 1, 
            padding: '9px 14px', 
            backgroundColor: hasChanges ? 'var(--zen-accent)' : '#9ca3af', 
            color: '#FFFFFF', 
            border: '1px solid var(--zen-border)', 
            borderRadius: '6px', 
            fontWeight: 700, 
            fontSize: '0.85rem', 
            cursor: hasChanges ? 'pointer' : 'not-allowed', 
            opacity: hasChanges ? 1 : 0.6,
            fontFamily: 'inherit', 
            boxShadow: 'none', 
            transition: 'all 0.1s'
          }}
          onMouseDown={e => { 
            if (hasChanges) {
              e.currentTarget.style.transform = 'translate(1px, 1px)'; 
              e.currentTarget.style.opacity = '0.9'; 
            }
          }}
          onMouseUp={e => { 
            if (hasChanges) {
              e.currentTarget.style.transform = 'none'; 
              e.currentTarget.style.opacity = '1'; 
            }
          }}
        >
          SAVE CHANGES
        </button>
      </div>
    </div>
  );
};

const TerminalView = ({ mode, sessionId, onExit, onProcessStart, onProcessExit, frugalConfig, setFrugalConfig, setIsHermesInstalled, setIsOpenCodeInstalled, setIsOllamaInstalled, setIsToolGatewayInstalled }: { mode: 'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-gateway' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama' | 'install-tool-gateway' | 'uninstall-tool-gateway', sessionId: string, onExit: () => void, onProcessStart?: () => void, onProcessExit?: () => void, frugalConfig?: any, setFrugalConfig?: any, setIsHermesInstalled: (installed: boolean) => void, setIsOpenCodeInstalled: (installed: boolean) => void, setIsOllamaInstalled: (installed: boolean) => void, setIsToolGatewayInstalled?: (installed: boolean) => void }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isProvisioningModel, setIsProvisioningModel] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [downloadStats, setDownloadStats] = useState<{
    completed: number;
    total: number;
    speedBytesPerSec: number;
    etaSeconds: number;
  }>({ completed: 0, total: 0, speedBytesPerSec: 0, etaSeconds: 0 });
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
    const kb = bytesPerSec / 1024;
    if (kb >= 1) return `${kb.toFixed(0)} KB/s`;
    return `${Math.round(bytesPerSec)} B/s`;
  };

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0) return '';
    if (seconds < 60) return `${seconds}s left`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s left`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m left`;
  };

  useEffect(() => {
    if (!terminalRef.current) return;
    const term = new Terminal({ 
      fontFamily: 'monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
      }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    try {
      fitAddon.fit();
    } catch (e) {
      console.error(e);
    }
    
    term.onResize(({ cols, rows }) => {
      invoke('resize_pty', { sessionId, cols, rows }).catch(console.error);
    });

    let fitTimeout: number | undefined;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(fitTimeout);
      fitTimeout = window.setTimeout(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.error(e);
        }
      }, 50);
    });
    resizeObserver.observe(terminalRef.current);

    let isMounted = true;
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    const setupPty = async () => {
      try {
        await invoke('kill_pty', { sessionId });
      } catch (e) {
        // Ignored
      }
      
      if (mode === 'install-tool-gateway') {
        setIsProvisioningModel(true);
        setDownloadPercent(0);
        setDownloadStats({ completed: 0, total: 0, speedBytesPerSec: 0, etaSeconds: 0 });
        term.writeln('Initializing Tool Enforcing Gateway (ONNX: Xenova/nli-deberta-v3-small)...');
        term.writeln('>>> Downloading ONNX model weights and tokenizer...');

        let lastCompleted = 0;
        let lastSpeedCalc = Date.now();
        let smoothedSpeed = 0;
        const fileProgress: Record<string, { loaded: number; total: number }> = {};

        try {
          await loadOnnxClassifier((info) => {
            if (info.status === 'progress' && info.total && info.file) {
              fileProgress[info.file] = { loaded: info.loaded || 0, total: info.total };
              let totalLoaded = 0;
              let totalSize = 0;
              Object.values(fileProgress).forEach(f => {
                totalLoaded += f.loaded;
                totalSize += f.total;
              });
              if (totalSize > 0) {
                const percent = Math.min(100, Math.round((totalLoaded / totalSize) * 100));
                setDownloadPercent(percent);
                
                const now = Date.now();
                const elapsedSec = (now - lastSpeedCalc) / 1000;
                if (elapsedSec >= 0.3) {
                  const delta = totalLoaded >= lastCompleted ? totalLoaded - lastCompleted : totalLoaded;
                  const instSpeed = delta / Math.max(0.1, elapsedSec);
                  smoothedSpeed = smoothedSpeed === 0 ? instSpeed : 0.65 * smoothedSpeed + 0.35 * instSpeed;
                  lastCompleted = totalLoaded;
                  lastSpeedCalc = now;
                }
                const remainingBytes = Math.max(0, totalSize - totalLoaded);
                const etaSec = smoothedSpeed > 1024 ? Math.round(remainingBytes / smoothedSpeed) : 0;
                setDownloadStats({
                  completed: totalLoaded,
                  total: totalSize,
                  speedBytesPerSec: smoothedSpeed,
                  etaSeconds: etaSec,
                });
              }
            } else if (info.status === 'done' && info.file) {
              term.writeln(`>>> Downloaded: ${info.file}`);
            }
          });

          setIsProvisioningModel(false);
          if (setIsToolGatewayInstalled) setIsToolGatewayInstalled(true);
          try {
            await invoke('set_tool_gateway_installed', { installed: true });
            if (setFrugalConfig) {
              setFrugalConfig((prev: any) => {
                const next = { ...prev, tool_enforcing_gateway: true };
                invoke('set_frugallm_config', { config: next }).catch(console.error);
                return next;
              });
            }
            term.writeln(`\r\n\x1b[32mTool Enforcing Gateway (ONNX: Xenova/nli-deberta-v3-small) installed successfully!\x1b[0m\r\n`);
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            setTimeout(() => { if (isMounted) onExit(); }, 2000);
          } catch (err) {
            term.writeln(`\r\n\x1b[31mFailed to update configuration: ${err}\x1b[0m\r\n`);
          }
        } catch (err) {
          setIsProvisioningModel(false);
          term.writeln(`\r\n\x1b[31mFailed to install ONNX model: ${err}\x1b[0m\r\n`);
        }
      } else if (mode === 'uninstall-tool-gateway') {
        term.writeln('Uninstalling Tool Enforcing Gateway (ONNX)...');
        try {
          await clearOnnxCache();
          if (setIsToolGatewayInstalled) setIsToolGatewayInstalled(false);
          await invoke('set_tool_gateway_installed', { installed: false });
          if (setFrugalConfig) {
            setFrugalConfig((prev: any) => {
              const next = { ...prev, tool_enforcing_gateway: false };
              invoke('set_frugallm_config', { config: next }).catch(console.error);
              return next;
            });
          }
          term.writeln(`\r\n\x1b[32mTool Enforcing Gateway (ONNX) cache cleared and uninstalled.\x1b[0m\r\n`);
          setTimeout(() => { if (isMounted) onExit(); }, 1500);
        } catch (err) {
          term.writeln(`\r\n\x1b[31mFailed to uninstall: ${err}\x1b[0m\r\n`);
        }
      } else if (mode.startsWith('install')) {
        let installingText = 'Initializing installation...';
        if (mode === 'install-hermes') installingText = 'Installing Hermes Agent...';
        if (mode === 'install-opencode') installingText = 'Installing OpenCode...';
        if (mode === 'install-ollama') installingText = 'Initializing Ollama installation...';
        term.writeln(installingText);
        
        unlistenOutput = await listen<{ session_id: string, data: string }>('pty_output', (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
            window.dispatchEvent(new CustomEvent('pty_bytes', { detail: event.payload.data.length }));
          }
        });
        unlistenExit = await listen<{ session_id: string, exit_code: number }>('pty_exit', async (event) => {
          if (event.payload.session_id !== sessionId) return;
          if (onProcessExit) onProcessExit();
          if (event.payload.exit_code === 0) {
            if (mode === 'install-opencode') {
              setIsOpenCodeInstalled(true);
              setTimeout(async () => {
                if (!isMounted) return;
                try {
                  await invoke('configure_opencode_defaults');
                  term.writeln(`\r\n\x1b[32mConfiguration applied. Closing...\x1b[0m\r\n`);
                  setTimeout(() => { if (isMounted) onExit(); }, 1000);
                } catch (err) {
                  term.writeln(`\r\n\x1b[31mFailed to configure OpenCode: ${err}\x1b[0m\r\n`);
                }
              }, 1000);
            } else if (mode !== 'install-ollama') {
              setTimeout(async () => {
                if (!isMounted) return;
                try {
                  await invoke('configure_hermes_defaults');
                  term.writeln(`\r\n\x1b[32mConfiguration applied.\x1b[0m\r\n`);
                  
                  if (setIsHermesInstalled) {
                    setIsHermesInstalled(true);
                  }
                  
                  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                  setTimeout(() => { if (isMounted) onExit(); }, 1500);
                } catch (err) {
                  term.writeln(`\r\n\x1b[31mFailed to configure Hermes: ${err}\x1b[0m\r\n`);
                }
              }, 1000);
            }
          } else {
            term.writeln(`\r\n\x1b[31mProcess exited with code ${event.payload.exit_code}\x1b[0m\r\n`);
          }
        });

        if (!isMounted) return;
        if (onProcessStart) onProcessStart();
        if (mode === 'install-opencode') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', 'export TERM=xterm-256color && curl -fsSL https://opencode.ai/install | bash'] });
        } else if (mode === 'install-ollama') {
          const unlisten1 = await listen<{ status: string }>('download_progress', (event) => term.write(event.payload.status));
          const unlisten2 = await listen<string>('installing_ollama', () => term.writeln('Installing Ollama Engine...'));
          const unlisten4 = await listen('model_provisioning_started', () => {
             setIsProvisioningModel(true);
             setDownloadPercent(0);
             setDownloadStats({ completed: 0, total: 0, speedBytesPerSec: 0, etaSeconds: 0 });
          });
          const unlisten5 = await listen<any>('model_download_progress', (event) => {
             if (typeof event.payload === 'number') {
               setDownloadPercent(event.payload);
             } else if (event.payload && typeof event.payload === 'object') {
               setDownloadPercent(event.payload.percent ?? 0);
               setDownloadStats({
                 completed: event.payload.completed ?? 0,
                 total: event.payload.total ?? 0,
                 speedBytesPerSec: event.payload.speed_bytes_per_sec ?? 0,
                 etaSeconds: event.payload.eta_seconds ?? 0,
               });
             }
          });
          const unlisten3 = await listen<{ success: boolean; message: string }>('model_deployment_complete', async (event) => {
            setIsProvisioningModel(false);
            if (event.payload.success) {
              setIsOllamaInstalled(true);
              term.writeln(`\r\n\x1b[32mModel Provisioned successfully.\x1b[0m\r\n`);
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
              setTimeout(() => { if (isMounted) onExit(); }, 3000);
            } else {
              console.error(event.payload.message);
              term.writeln(`\r\n\x1b[31mInstallation failed: ${event.payload.message}\x1b[0m\r\n`);
            }
            unlisten1();
            unlisten2();
            unlisten3();
            unlisten4();
            unlisten5();
          });
          
          invoke('deploy_local_model').catch((err) => {
            console.error(err);
            setIsProvisioningModel(false);
            term.writeln(`\r\n\x1b[31mInstallation failed: ${err}\x1b[0m\r\n`);
            unlisten1();
            unlisten2();
            unlisten3();
            unlisten4();
            unlisten5();
          });
        } else {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', 'export TERM=xterm-256color && curl -sSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-setup'] });
        }
        invoke('resize_pty', { sessionId, cols: term.cols, rows: term.rows }).catch(console.error);
      } else if (mode.startsWith('run')) {
        let runningText = 'Starting...';
        if (mode.startsWith('run-opencode')) runningText = 'Starting OpenCode...';
        if (mode.startsWith('run-hermes')) runningText = 'Starting Hermes Agent...';
        if (mode === 'run-ollama') runningText = 'Chatting with Ollama...';
        term.writeln(runningText);
        const dataListener = term.onData((data) => {
          invoke('write_pty', { sessionId, data }).catch(console.error);
        });
        unlistenOutput = await listen<{ session_id: string, data: string }>('pty_output', (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
            window.dispatchEvent(new CustomEvent('pty_bytes', { detail: event.payload.data.length }));
          }
        });
        unlistenExit = await listen<{ session_id: string, exit_code: number }>('pty_exit', (event) => {
          if (event.payload.session_id !== sessionId) return;
          if (onProcessExit) onProcessExit();
          let name = 'Process';
          if (mode.startsWith('run-opencode')) name = 'OpenCode';
          if (mode.startsWith('run-hermes')) name = 'Hermes';
          if (mode === 'run-ollama') name = 'Ollama';
          term.writeln(`\r\n\x1b[32m${name} exited with code ${event.payload.exit_code}\x1b[0m\r\n`);
        });
        
        if (!isMounted) return;
        if (onProcessStart) onProcessStart();
        const frugalEnv = `export OPENAI_API_BASE="http://${frugalConfig?.ip || '127.0.0.1'}:${frugalConfig?.port || '61721'}/v1" && export OPENAI_API_KEY="${frugalConfig?.api_password || 'frugallm'}"`;
        
        if (mode === 'run-opencode') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.opencode/bin:$PATH" && ${frugalEnv} && opencode -m litellm/frugallm`] });
        } else if (mode === 'run-opencode-web') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.opencode/bin:$PATH" && ${frugalEnv} && opencode web`] });
        } else if (mode === 'run-ollama') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Ollama.app/Contents/Resources:$PATH" && ${frugalEnv} && ollama run frugallm-active`] });
        } else if (mode === 'run-hermes-web') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.hermes/bin:$PATH" && ${frugalEnv} && hermes dashboard --host 127.0.0.1`] });
        } else if (mode === 'run-hermes-desktop') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.hermes/bin:$PATH" && ${frugalEnv} && hermes desktop`] });
        } else if (mode === 'run-hermes-gateway') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.hermes/bin:$PATH" && ${frugalEnv} && hermes gateway --host 127.0.0.1`] });
        } else {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.hermes/bin:$PATH" && ${frugalEnv} && hermes`] });
        }
        invoke('resize_pty', { sessionId, cols: term.cols, rows: term.rows }).catch(console.error);
        
        const cleanup = unlistenExit;
        unlistenExit = () => {
          dataListener.dispose();
          if (cleanup) cleanup();
        };
      }
    };

    setupPty();

    return () => {
      isMounted = false;
      window.clearTimeout(fitTimeout);
      resizeObserver.disconnect();
      if (unlistenOutput) unlistenOutput();
      if (unlistenExit) unlistenExit();
      term.dispose();
    };
  }, [mode, sessionId]);

  let title = 'Terminal Runner';
  if (mode === 'install-hermes') title = 'Hermes Agent Installation';
  if (mode === 'run-hermes') title = 'Hermes Terminal';
  if (mode === 'run-hermes-web') title = 'Hermes WebUI';
  if (mode === 'run-hermes-desktop') title = 'Hermes App';
  if (mode === 'run-hermes-gateway') title = 'Hermes Gateway';
  if (mode === 'install-opencode') title = 'OpenCode Installation';
  if (mode === 'run-opencode') title = 'OpenCode Terminal';
  if (mode === 'run-opencode-web') title = 'OpenCode Web UI';
  if (mode === 'install-ollama') title = 'Ollama';
  if (mode === 'run-ollama') title = 'Ollama Local Chat';
  if (mode === 'install-tool-gateway' || mode === 'uninstall-tool-gateway') title = 'Tool Enforcing Gateway';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--zen-surface)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--zen-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--zen-surface-hover)', borderBottom: '1px solid var(--zen-border)' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--zen-text)', margin: 0 }}>
          {title}
        </h2>
        {showConfirmClose ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>{en.routingGraph.terminal.confirmClose}</span>
            <button onClick={() => {
              invoke('kill_pty', { sessionId }).catch(console.error);
              onExit();
            }} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', borderRadius: '8px' }}>{en.routingGraph.terminal.yes}</button>
            <button onClick={() => setShowConfirmClose(false)} style={{ padding: '6px 12px', backgroundColor: 'transparent', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', fontWeight: 600, cursor: 'pointer', borderRadius: '8px' }}>{en.routingGraph.terminal.cancel}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={() => onExit()}
              title="Hide terminal and keep process running in background"
              style={{ background: 'none', border: '1px solid var(--zen-border)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--zen-text)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>_</span> HIDE
            </button>
            <button 
              onClick={() => setShowConfirmClose(true)}
              title="Close process"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {isProvisioningModel && (
        <div style={{ padding: '14px 24px', backgroundColor: 'var(--zen-surface-hover)', borderBottom: '1px solid var(--zen-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--zen-text)' }}>Downloading Weights...</span>
               {downloadStats.total > 0 && (
                 <span data-testid="download-size" style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)', fontWeight: 500, fontFamily: 'monospace' }}>
                   ({formatBytes(downloadStats.completed)} / {formatBytes(downloadStats.total)})
                 </span>
               )}
             </div>

             <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
               {downloadStats.speedBytesPerSec > 0 && (
                 <span data-testid="download-speed" style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                   {formatSpeed(downloadStats.speedBytesPerSec)}
                 </span>
               )}
               {downloadStats.etaSeconds > 0 && (
                 <span data-testid="download-eta" style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                   {formatEta(downloadStats.etaSeconds)}
                 </span>
               )}
               <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--zen-accent)', minWidth: '38px', textAlign: 'right' }}>
                 {downloadPercent}%
               </span>
             </div>
           </div>

           <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--zen-border)', borderRadius: '3px', overflow: 'hidden' }}>
             <div style={{ width: `${downloadPercent}%`, height: '100%', backgroundColor: 'var(--zen-accent)', transition: 'width 0.2s linear' }} />
           </div>
        </div>
      )}

      <div style={{ flex: 1, backgroundColor: '#000000', padding: '10px', overflow: 'hidden' }}>
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

function AppContent() {
  const memory = useMemory();
  const memoryRef = useRef(memory);
  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  const { onboardingState, handleDecision, isLoaded } = useOnboarding();
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  
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
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [terminalMode, setTerminalMode] = useState<'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-gateway' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama' | 'install-tool-gateway' | 'uninstall-tool-gateway' | null>(null);
  const [isHermesInstalled, setIsHermesInstalled] = useState<boolean | null>(null);
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState<boolean | null>(null);
  const [hermesVersion, setHermesVersion] = useState<string>('N/A');
  const [opencodeVersion, setOpencodeVersion] = useState<string>('N/A');
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean | null>(null);
  const [isToolGatewayInstalled, setIsToolGatewayInstalled] = useState<boolean | null>(null);

    const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [initLogs, setInitLogs] = useState<string[]>([]);
  const [frugalConfig, setFrugalConfig] = useState<any>(null);
  const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>({});
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitServices, setExitServices] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const runInit = async () => {
      const addLog = (msg: string) => {
        if (isMounted) setInitLogs(prev => [...prev, msg]);
      };

      addLog("Booting FrugaLLM core subsystems...");
      await new Promise(r => setTimeout(r, 300));
      
      addLog("Fetching node configuration...");
      try {
        const conf = await invoke('get_frugallm_config');
        setFrugalConfig(conf);
        addLog("OK: Configuration loaded.");
      } catch (e) {
        addLog("WARN: Failed to load config.");
      }
      await new Promise(r => setTimeout(r, 200));

      addLog("Checking Hermes agent status...");
      try {
        const hermesStatus = await invoke('check_hermes_status');
        setIsHermesInstalled(hermesStatus as boolean);
        if (hermesStatus) {
          invoke<string>('get_hermes_version').then(v => setHermesVersion(v)).catch(() => setHermesVersion('N/A'));
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
        const opencodeStatus = await invoke('check_opencode_status');
        setIsOpenCodeInstalled(opencodeStatus as boolean);
        if (opencodeStatus) {
          invoke<string>('get_opencode_version').then(v => setOpencodeVersion(v)).catch(() => setOpencodeVersion('N/A'));
        }
        addLog(opencodeStatus ? "OK: OpenCode installed." : "INFO: OpenCode not installed.");
      } catch(e) {}
      await new Promise(r => setTimeout(r, 200));

      addLog("Detecting Ollama daemon...");
      try {
        const ollamaStatus = await invoke('check_ollama_status');
        setIsOllamaInstalled(ollamaStatus as boolean);
        addLog(ollamaStatus ? "OK: Ollama detected." : "INFO: Ollama not detected.");
      } catch(e) {}
      
      addLog("Checking Tool Enforcing Gateway status...");
      try {
        const toolGatewayStatus = await invoke('check_tool_gateway_status');
        setIsToolGatewayInstalled(toolGatewayStatus as boolean);
        addLog(toolGatewayStatus ? "OK: Tool Gateway installed." : "INFO: Tool Gateway not installed.");
      } catch(e) {}
      
      addLog("Detecting system VRAM...");
      try {
        const vram = await invoke('detect_vram');
        if (vram !== null && vram !== undefined) {
          const vramGb = Math.round(Number(vram) / 1024);
          setDetectedVram(String(vramGb));
          memoryRef.current.setDetectedVramGb(vramGb);
          try {
            const tag = await invoke<string>('get_model_tag_for_vram', { detectedVramGb: vramGb });
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
        const key = await invoke<string | null>('get_credential', { service: 'openrouter' });
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
        const key = await invoke<string | null>('get_credential', { service: 'google' });
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

      addLog("Checking server status...");
      try {
        const status = await invoke<any>('get_frugallm_server_status');
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
      
      if (isMounted) setIsAppLoaded(true);
    };
    
    runInit();
    return () => { isMounted = false; };
  }, []);


  useEffect(() => {
    const unlistenConfig = listen('frugallm_config_updated', () => {
      invoke('get_frugallm_config').then((conf: any) => setFrugalConfig(conf)).catch(console.error);
    });
    const unlistenError = listen('frugallm_port_error', (event: any) => {
      const port = event.payload;
      const numericPort = typeof port === 'number' ? port : parseInt(port, 10);
      setPortConflict({
        port: numericPort || 61721,
        message: `Close the service currently using port [${numericPort || 61721}] and restart the app.`
      });
    });
    const unlistenStatus = listen('frugallm_server_status', (event: any) => {
      const statusObj = event.payload;
      if (statusObj?.status === 'PortConflict') {
        setPortConflict({
          port: statusObj.data?.port || 61721,
          message: statusObj.data?.message || `Close the service currently using port [${statusObj.data?.port || 61721}] and restart the app.`
        });
      } else if (statusObj?.status === 'Running') {
        setPortConflict(null);
      }
    });
    return () => {
      unlistenConfig.then(f => f());
      unlistenError.then(f => f());
      unlistenStatus.then(f => f());
    };
  }, []);

  useEffect(() => {
    // Resize observer logic moved to useCanvasLogic
  }, [terminalMode]);

  const spreadWidth = Math.max(containerSize.width, 800);
  const spreadHeight = Math.max(containerSize.height, 600);
  const autoScale = Math.min(containerSize.width / 800, containerSize.height / 600, 1);

  const renderedNodes = nodes.map(node => {
    const layout = nodeLayout[node.id] || { rx: 0, ry: 0 };
    return {
      ...node,
      x: (containerSize.width / 2) + (layout.rx * spreadWidth) - (NODE_WIDTH / 2),
      y: (containerSize.height / 2) + (layout.ry * spreadHeight) - (NODE_HEIGHT / 2)
    };
  });


  // UI State

  const [portConflict, setPortConflict] = useState<{ port: number; message: string } | null>(null);
  const [detectedVram, setDetectedVram] = useState<string>('8'); // Default placeholder
  const [latestTelemetry, setLatestTelemetry] = useState<any>(null);
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(null);

  const [activeProxyState, setActiveProxyState] = useState<{source: string, target: string} | null>(null);
  const proxyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<HardwareProfile>('detect_hardware_profile')
      .then((profile) => {
        setHardwareProfile(profile);
        memoryRef.current.setHardwareProfile(profile);
        let vramGb = 8;
        if (profile.is_unified) {
          vramGb = Math.round(profile.execution_ceiling / 1024 / 1024 / 1024);
        } else if (profile.dedicated_vram > 0) {
          vramGb = Math.round(profile.dedicated_vram / 1024 / 1024 / 1024);
        }
        setDetectedVram(vramGb.toString());
        memoryRef.current.setDetectedVramGb(vramGb);
        invoke<string>('get_model_tag_for_vram', { detectedVramGb: vramGb })
          .then((tag) => {
            if (tag) memoryRef.current.setActiveModelName(tag);
          })
          .catch(() => {});
      })
      .catch(() => {
        invoke<number>('detect_vram')
          .then((vram) => {
            const vramGb = Math.round(vram / 1024);
            setDetectedVram(vramGb.toString());
            memoryRef.current.setDetectedVramGb(vramGb);
            invoke<string>('get_model_tag_for_vram', { detectedVramGb: vramGb })
              .then((tag) => {
                if (tag) memoryRef.current.setActiveModelName(tag);
              })
              .catch(() => {});
          })
          .catch(() => {
            setDetectedVram('8');
            memoryRef.current.setDetectedVramGb(8);
            invoke<string>('get_model_tag_for_vram', { detectedVramGb: 8.0 })
              .then((tag) => {
                if (tag) memoryRef.current.setActiveModelName(tag);
              })
              .catch(() => {});
          });
      });
  }, []);

  useEffect(() => {
    if (isHermesInstalled !== null) {
      const isRunning = activeProcesses['run-hermes'] || activeProcesses['run-hermes-desktop'] || activeProcesses['run-hermes-web'];
      const status = isRunning ? 'active' : (isHermesInstalled ? 'ready' : 'not_installed');
      setNodes(nds => nds.map(n => n.id === 'node-hermes' && n.data.status !== status ? { ...n, data: { ...n.data, status } } : n));
      if (isHermesInstalled) {
        invoke<string>('get_hermes_version').then(v => setHermesVersion(v)).catch(() => setHermesVersion('N/A'));
      } else {
        setHermesVersion('N/A');
      }
    }
  }, [isHermesInstalled, activeProcesses]);

  useEffect(() => {
    if (isOpenCodeInstalled !== null) {
      const isRunning = activeProcesses['run-opencode'] || activeProcesses['run-opencode-web'];
      const status = isRunning ? 'active' : (isOpenCodeInstalled ? 'ready' : 'not_installed');
      setNodes(nds => nds.map(n => n.id === 'node-opencode' && n.data.status !== status ? { ...n, data: { ...n.data, status } } : n));
      if (isOpenCodeInstalled) {
        invoke<string>('get_opencode_version').then(v => setOpencodeVersion(v)).catch(() => setOpencodeVersion('N/A'));
      } else {
        setOpencodeVersion('N/A');
      }
    }
  }, [isOpenCodeInstalled, activeProcesses]);

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
    listen<{source: string, target: string, is_active: boolean}>('proxy_activity', (event) => {
      if (proxyTimeout.current) clearTimeout(proxyTimeout.current);
      if (event.payload.is_active) {
        setActiveProxyState({ source: event.payload.source, target: event.payload.target });
        // Fallback timeout in case the drop event is lost
        proxyTimeout.current = setTimeout(() => setActiveProxyState(null), 120000);
      } else {
        setActiveProxyState(null);
      }
    }).then(unlisten => {
      unlistenProxy = unlisten;
    }).catch(console.error);

    let unlistenExit: (() => void) | null = null;
    listen('request_exit_confirmation', async () => {
      try {
        const svcs = await invoke<string[]>('get_active_services');
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
      if (proxyTimeout.current) {
        clearTimeout(proxyTimeout.current);
      }
    };
  }, []);

  const handleInitializeHermes = () => setTerminalMode('install-hermes');
  const handleOpenHermes = () => setTerminalMode('run-hermes');
  const handleOpenHermesGateway = () => setTerminalMode('run-hermes-gateway');
  const handleOpenHermesDesktop = () => setTerminalMode('run-hermes-desktop');
  const handleOpenHermesWeb = () => setTerminalMode('run-hermes-web');
  const handleKillProcess = (mode: string) => {
    invoke('kill_pty', { sessionId: mode }).catch(console.error);
    invoke('stop_hermes_service', { service: mode }).catch(console.error);
    if (mode === 'run-hermes-desktop') {
      invoke('kill_pty', { sessionId: 'run-hermes-desktop' }).catch(console.error);
      setActiveProcesses(prev => ({ ...prev, 'run-hermes-desktop': false }));
    }
    if (mode === 'run-hermes-gateway' || mode === 'hermes-gateway') {
      invoke('kill_pty', { sessionId: 'run-hermes-gateway' }).catch(console.error);
      invoke('stop_hermes_service', { service: 'gateway' }).catch(console.error);
      setActiveProcesses(prev => ({ ...prev, 'run-hermes-gateway': false, 'hermes-gateway': false }));
    }
    if (mode === 'run-hermes-web' || mode === 'hermes-dashboard') {
      invoke('kill_pty', { sessionId: 'run-hermes-web' }).catch(console.error);
      invoke('stop_hermes_service', { service: 'dashboard' }).catch(console.error);
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
    await invoke('spawn_pty', { command: 'bash', args: ['-c', 'rm -rf ~/.hermes'] });
    setIsHermesInstalled(false);
  };
  const handleUninstallOpenCode = async () => {
    await invoke('spawn_pty', { command: 'bash', args: ['-c', 'rm -rf ~/.opencode && rm -rf ~/.config/opencode'] });
    setIsOpenCodeInstalled(false);
  };
  const handleUninstallOllama = async () => {
    try {
      await invoke('uninstall_ollama');
    } catch (e) {
      console.error('Failed to uninstall Ollama:', e);
    }
    setIsOllamaInstalled(false);
    setNodes(nds => nds.map(n => n.id === 'node-ollama' ? { ...n, data: { ...n.data, status: 'ready' } } : n));
  };
  const handleDisconnectOpenRouter = async () => {
    await invoke('delete_credential', { service: 'openrouter' }).catch(console.error);
    setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'needs_activation', apiKey: '', keyPrefix: '', lastStatus: '' } } : n));
    await invoke('refresh_routing_chain').catch(console.error);
  };
  const handleDisconnectGoogle = async () => {
    await invoke('delete_credential', { service: 'google' }).catch(console.error);
    setNodes(nds => nds.map(n => n.id === 'node-google' ? { ...n, data: { ...n.data, status: 'needs_activation', googleApiKey: '', keyPrefix: '', lastStatus: '' } } : n));
    await invoke('refresh_routing_chain').catch(console.error);
  };

  const [activeGuide, setActiveGuide] = useState<string | null>(null);
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
          input_tokens_session: frugalConfig?.input_tokens_session || 0,
          output_tokens_session: frugalConfig?.output_tokens_session || 0,
          input_tokens_lifetime: frugalConfig?.input_tokens_lifetime || 0,
          output_tokens_lifetime: frugalConfig?.output_tokens_lifetime || 0,
          hermes_workspace: frugalConfig?.hermes_workspace || null,
          opencode_workspace: frugalConfig?.opencode_workspace || null,
          start_minimized: Boolean(finalConfig.start_minimized),
        };
        await invoke('set_frugallm_config', { newConfig: newConf });
        invoke('get_frugallm_config').then((conf: any) => setFrugalConfig(conf)).catch(console.error);
        invoke<any>('get_frugallm_server_status').then((st: any) => {
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
        await invoke('set_frugallm_config', { newConfig: newConf });
        invoke('get_frugallm_config').then((conf: any) => setFrugalConfig(conf)).catch(console.error);
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
        try {
          const res = await tauriFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${finalConfig.googleApiKey}`, { method: 'GET' });
          if (res.ok) {
            await invoke('set_credential', { service: 'google', secret: finalConfig.googleApiKey });
            await invoke('refresh_routing_chain').catch(console.error);
            finalConfig.status = 'active';
            finalConfig.keyPrefix = finalConfig.googleApiKey.slice(0, 5);
            finalConfig.lastStatus = '200 OK';
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#3b82f6', '#ffffff', '#111827']
            });
          } else {
             console.error("Google API key test failed", res.status);
             finalConfig.status = 'error';
             finalConfig.lastStatus = `${res.status} Error`;
          }
        } catch (e) {
          console.error("Failed to save google credential", e);
          finalConfig.status = 'error';
          finalConfig.lastStatus = 'Error';
        }
        delete finalConfig.googleApiKey;
      }
    }
    
    if (nodeId === 'node-openrouter') {
      if (finalConfig.apiKey) {
        try {
          const res = await tauriFetch(`https://openrouter.ai/api/v1/auth/key`, { 
            method: 'GET',
            headers: { 'Authorization': `Bearer ${finalConfig.apiKey}` }
          });
          if (res.ok) {
            await invoke('set_credential', { service: 'openrouter', secret: finalConfig.apiKey });
            await invoke('refresh_routing_chain').catch(console.error);
            finalConfig.status = 'active';
            finalConfig.keyPrefix = finalConfig.apiKey.slice(0, 5);
            finalConfig.lastStatus = '200 OK';
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#ea580c', '#ffffff', '#111827']
            });
          } else {
            console.error("OpenRouter API key test failed", res.status);
            finalConfig.status = 'error';
            finalConfig.lastStatus = `${res.status} Error`;
          }
        } catch (e) {
          console.error("Failed to save openrouter credential", e);
          finalConfig.status = 'error';
          finalConfig.lastStatus = 'Error';
        }
        delete finalConfig.apiKey;
      }
    }
    
    if (nodeId === 'node-ollama') {
      try {
        const res = await tauriFetch(`http://${finalConfig.ip}:${finalConfig.port}/api/version`, { method: 'GET' });
        if (res.ok) {
          await invoke('refresh_routing_chain').catch(console.error);
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

  const renderEdge = (edge: any) => {
    const source = renderedNodes.find(n => n.id === edge.source);
    const target = renderedNodes.find(n => n.id === edge.target);
    if (!source || !target) return null;

    const sx = source.x + NODE_WIDTH / 2;
    const sy = source.y + NODE_HEIGHT / 2;
    const tx = target.x + NODE_WIDTH / 2;
    const ty = target.y + NODE_HEIGHT / 2;

    const pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
    
    let isGenerating = false;
    if (edge.id === 'edge-hermes-frugallm') isGenerating = activeProxyState?.source === 'hermes';
    else if (edge.id === 'edge-opencode-frugallm') isGenerating = activeProxyState?.source === 'opencode';
    else if (edge.id === 'edge-frugallm-ollama') isGenerating = activeProxyState?.target === 'ollama';
    else if (edge.id === 'edge-frugallm-openrouter') isGenerating = activeProxyState?.target === 'openrouter';
    else if (edge.id === 'edge-ollama-hardware') isGenerating = activeProxyState?.target === 'ollama' || terminalMode === 'run-ollama';
    else if (edge.id === 'edge-openrouter-cloud') isGenerating = source.data.isGenerating === true || activeProxyState?.target === 'openrouter';

    return (
      <g key={edge.id}>
        {/* Base line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--zen-border)"
          strokeWidth="3"
          strokeOpacity="1"
          strokeLinecap="round"
        />
        {/* Animated active state */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--zen-accent)"
          strokeWidth="3"
          strokeOpacity={isGenerating ? "1" : "0"}
          strokeDasharray="8 8"
          strokeLinecap="round"
          className={isGenerating ? "edge-stream-forward" : ""}
        />
      </g>
    );
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const hasActiveBackend = nodes.some(n => (n.id === 'node-ollama' || n.id === 'node-openrouter' || n.id === 'node-google') && n.data.status === 'active');

  if (!isLoaded) return null;

  return !isAppLoaded ? <TerminalLoader logs={initLogs} /> : (
    <div 
      style={{ display: 'flex', width: '100%', height: '100vh', fontFamily: 'inherit', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '8px', overflow: 'hidden', overscrollBehavior: 'none' }}
    >
      <style>
        {`
          @keyframes streamForward {
            0% { stroke-dashoffset: 40; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes streamReverse {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 40; }
          }
          .edge-stream-forward {
            animation: streamForward 0.8s linear infinite;
          }
          .edge-stream-reverse {
            animation: streamReverse 1.1s linear infinite;
          }
          .retro-node {
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
          }
          .retro-node:hover {
            transform: translateY(-4px) scale(1.02);
          }
          .terminal-drawer {
            transition: transform 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
          }
        `}
      </style>

      {/* Canvas Area */}
      {(['install-hermes', 'run-hermes', 'run-hermes-web', 'run-hermes-gateway', 'run-hermes-desktop', 'install-opencode', 'run-opencode', 'run-opencode-web', 'install-ollama', 'run-ollama', 'install-tool-gateway', 'uninstall-tool-gateway'] as const).map((mode) => {
        const isActive = activeProcesses[mode] || terminalMode === mode;
        if (!isActive) return null;
        return (
          <div key={mode} style={{ display: terminalMode === mode ? 'flex' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 50, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
            <TerminalView
               mode={mode}
               sessionId={mode}
               onExit={() => {
                 setTerminalMode(null);
                 invoke('check_hermes_status').then((installed) => setIsHermesInstalled(installed as boolean));
                 invoke('check_opencode_status').then((installed) => setIsOpenCodeInstalled(installed as boolean));
                 invoke('check_ollama_status').then((installed) => setIsOllamaInstalled(installed as boolean));
                 invoke('check_tool_gateway_status').then((installed) => setIsToolGatewayInstalled(installed as boolean));
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

        <div 
          ref={canvasRef}
          data-testid="main-canvas"
          onClick={handleCanvasClick}
          style={{ 
            flexGrow: 1, position: 'relative', 
            cursor: 'default',
            display: terminalMode ? 'none' : 'block',
            overscrollBehavior: 'none'
          }}
        >
        {portConflict && !terminalMode && (
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '12px', left: 0, right: 0, zIndex: 40, pointerEvents: 'auto', display: 'flex', justifyContent: 'center' }}>
            <PortConflictBanner
              port={portConflict.port}
              onConfigurePort={() => setSelectedNodeId('node-frugallm')}
              onDismiss={() => setPortConflict(null)}
            />
          </div>
        )}


        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          transform: `scale(${autoScale}) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          pointerEvents: 'none'
        }}>
          {/* SVG Layer for Connections */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
            {initialEdges.map(renderEdge)}
          </svg>

          {/* Nodes Layer */}
          <div style={{ pointerEvents: 'auto' }}>
            {renderedNodes.map(node => {
              const isSelected = selectedNodeId === node.id;
              const isCore = node.id === 'node-frugallm';
              
              let stateColors = {
                border: isCore && portConflict ? '#ef4444' : 'var(--zen-border)',
                headerBg: isCore && portConflict ? '#fef2f2' : 'var(--zen-surface-hover)', 
                headerText: isCore && portConflict ? '#991b1b' : 'var(--zen-text)',
                bodyBg: 'var(--zen-surface)',
                dot: isCore && portConflict ? '#ef4444' : 'var(--zen-success)',
                statusText: 'var(--zen-text-secondary)',
                boxShadow: isCore && portConflict ? '0 0 16px rgba(239, 68, 68, 0.4), var(--tw-shadow-glass)' : 'var(--tw-shadow-glass)',
                borderStyle: 'solid',
                borderWidth: '2px'
              };

              let Icon = Icons.cpu;
              if (node.id.includes('openrouter') || node.id.includes('google')) Icon = Icons.cloud;
              if (node.id === 'node-opencode') Icon = Icons.code;
              if (node.id === 'node-hermes') Icon = Icons.workflow;
              if (node.data.isAgent) Icon = Icons.agent;

              if (node.id === 'node-ollama') {
                const isOllamaGenerating = activeProxyState?.target === 'ollama' || terminalMode === 'run-ollama';
                return (
                  <div
                    key={node.id}
                    id={node.id}
                    data-node-id={node.id}
                    className="retro-node"
                    style={{ 
                      position: 'absolute', left: node.x, top: node.y, width: NODE_WIDTH, 
                      zIndex: isSelected ? 5 : 1,
                      backgroundColor: 'var(--zen-surface)',
                      border: '2px solid var(--zen-border)',
                      borderRadius: '8px',
                      boxShadow: isSelected ? `0 0 0 4px #cbd5e1, var(--tw-shadow-glass)` : 'var(--tw-shadow-glass)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      userSelect: 'none',
                      overflow: 'hidden'
                    }}
                    onMouseDown={(e) => handleCanvasMouseDown(e)}
                    onClick={(e) => handleNodeClick(e, node.id)}
                  >
                    <HardwareNode isGenerating={isOllamaGenerating} label={node.data.label} subheader={node.data.subheader} />
                  </div>
                );
              }
              


              return (
                <div 
                  key={node.id}
                  data-node-id={node.id}
                  className="retro-node"
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: NODE_WIDTH,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    backgroundColor: stateColors.bodyBg,
                    border: `${stateColors.borderWidth} ${stateColors.borderStyle} ${stateColors.border}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: isSelected ? `0 0 0 4px #cbd5e1, ${stateColors.boxShadow}` : stateColors.boxShadow,
                    zIndex: isSelected ? 5 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleCanvasMouseDown(e)}
                  onClick={(e) => handleNodeClick(e, node.id)}
                >
                  {/* Header */}
                  <div style={{ 
                    backgroundColor: stateColors.headerBg, 
                    color: stateColors.headerText,
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: `2px ${stateColors.borderStyle} ${stateColors.border}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {Icon}
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: stateColors.headerText, letterSpacing: '0.5px' }}>
                          {node.data.label}
                        </span>
                        {node.data.subheader && (
                          <span style={{ fontWeight: 500, fontSize: '0.62rem', color: 'var(--zen-text-secondary)', opacity: 0.9 }}>
                            {node.data.subheader}
                          </span>
                        )}
                      </div>
                      {isCore && portConflict && (
                        <span
                          data-testid="frugallm-port-conflict-badge"
                          style={{
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            letterSpacing: '0.05em'
                          }}
                        >
                          PORT CONFLICT
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeClick(e, node.id);
                        }}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: stateColors.dot,
                          transition: 'opacity 0.2s',
                          opacity: 0.8
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                      >
                        {Icons.settings}
                      </div>
                    </div>
                  </div>
                  
                  {/* Body */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: stateColors.bodyBg, color: 'var(--zen-text)' }}>
                    {isCore ? (
                      <>
                        {portConflict && (
                          <div
                            data-testid="frugallm-node-conflict-warning"
                            style={{
                              backgroundColor: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#991b1b',
                              borderRadius: '4px',
                              padding: '4px 6px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textAlign: 'center'
                            }}
                          >
                            Port {portConflict.port} Conflict
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>Session tokens:</span>
                          <span data-testid="frugallm-session-tokens" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)' }}>
                            {((frugalConfig?.input_tokens_session || 0) + (frugalConfig?.output_tokens_session || 0)).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>Total tokens:</span>
                          <span data-testid="frugallm-total-tokens" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)' }}>
                            {((frugalConfig?.input_tokens_lifetime || 0) + (frugalConfig?.output_tokens_lifetime || 0)).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>$ Saved:</span>
                          <span data-testid="frugallm-money-saved" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-success)' }}>
                            ${((((frugalConfig?.input_tokens_lifetime || 0) * 3.0) + ((frugalConfig?.output_tokens_lifetime || 0) * 15.0)) / 1_000_000).toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (node.id === 'node-openrouter' || node.id === 'node-google') ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>API Key</span>
                          {node.data.status === 'active' ? (
                            <span data-testid={`${node.id}-api-key`} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                              {node.data.keyPrefix ? `${node.data.keyPrefix}...` : (node.id === 'node-google' ? 'AIzaS...' : 'sk-or...')}
                            </span>
                          ) : (
                            <a
                              href={node.id === 'node-openrouter' ? 'https://openrouter.ai' : 'https://aistudio.google.com'}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                openUrl(node.id === 'node-openrouter' ? 'https://openrouter.ai' : 'https://aistudio.google.com').catch(() => {});
                              }}
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: 'var(--zen-accent)',
                                textDecoration: 'underline',
                                cursor: 'pointer'
                              }}
                            >
                              Get key
                            </a>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>Status</span>
                          <span data-testid={`${node.id}-status`} style={{ fontSize: '0.75rem', fontWeight: 600, color: node.data.status === 'active' ? 'var(--zen-success)' : 'var(--zen-text-secondary)' }}>
                            {node.data.status === 'active' ? (node.data.lastStatus || '200 OK') : 'N/A'}
                          </span>
                        </div>
                      </>
                    ) : (node.id === 'node-hermes' || node.id === 'node-opencode') ? (
                      (() => {
                        const isHermes = node.id === 'node-hermes';
                        const isInstalled = isHermes ? isHermesInstalled : isOpenCodeInstalled;
                        const isRunning = isHermes 
                          ? !!(activeProcesses['run-hermes'] || activeProcesses['run-hermes-gateway'] || activeProcesses['run-hermes-desktop'] || activeProcesses['run-hermes-web'] || activeProcesses['hermes-gateway'] || activeProcesses['hermes-dashboard'] || node.data.status === 'active')
                          : !!(activeProcesses['run-opencode'] || activeProcesses['run-opencode-web'] || node.data.status === 'active');
                        
                        const statusText = !isInstalled ? 'N/A' : (isRunning ? 'Active' : 'Standby');
                        const statusColor = !isInstalled ? 'var(--zen-text-secondary)' : (isRunning ? 'var(--zen-success)' : '#eab308');
                        const versionText = !isInstalled ? 'N/A' : (isHermes ? hermesVersion : opencodeVersion);

                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>Status:</span>
                              <span data-testid={`${node.id}-status`} style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor }}>
                                {statusText}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af' }}>Version:</span>
                              <span data-testid={`${node.id}-version`} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                                {versionText}
                              </span>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <StatusLight status={node.data.status as any} text={node.data.status === 'active' ? 'Connected' : node.data.status === 'ready' ? (node.id === 'node-ollama' && isOllamaInstalled ? 'Stopped' : 'Ready') : (node.data.status.replace('_', ' ').toUpperCase())} />
                        <InfoField label={'ENDPOINT'} value={node.data.port ? `${node.data.ip}:${node.data.port}` : `${node.data.ip}`} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
      {/* Settings Modal */}
      {selectedNode && !terminalMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedNodeId(null)}>
          <NodeConfigPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} onSave={handleSaveNodeConfig} onOpenGuide={setActiveGuide} isHermesInstalled={isHermesInstalled} isOpenCodeInstalled={isOpenCodeInstalled} isOllamaInstalled={isOllamaInstalled} isToolGatewayInstalled={isToolGatewayInstalled} detectedVram={detectedVram} setDetectedVram={setDetectedVram} hasActiveBackend={hasActiveBackend} handleInitializeHermes={handleInitializeHermes} handleOpenHermes={handleOpenHermes} handleUninstallHermes={handleUninstallHermes} handleInitializeOpenCode={handleInitializeOpenCode} handleOpenOpenCode={handleOpenOpenCode} handleUninstallOpenCode={handleUninstallOpenCode} handleInitializeOllama={handleInitializeOllama} handleOpenOllama={handleOpenOllama} handleUninstallOllama={handleUninstallOllama} handleInstallToolGateway={handleInstallToolGateway} handleUninstallToolGateway={handleUninstallToolGateway} handleDisconnectOpenRouter={handleDisconnectOpenRouter} handleDisconnectGoogle={handleDisconnectGoogle} frugalConfig={frugalConfig} setFrugalConfig={setFrugalConfig} handleOpenHermesGateway={handleOpenHermesGateway} handleOpenHermesDesktop={handleOpenHermesDesktop} handleOpenHermesWeb={handleOpenHermesWeb} handleOpenOpenCodeWeb={handleOpenOpenCodeWeb} activeProcesses={activeProcesses} handleKillProcess={handleKillProcess} latestTelemetry={latestTelemetry} hardwareProfile={hardwareProfile} portConflict={portConflict} />
        </div>
      )}

      {/* Guides Modal */}
      {guidesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setGuidesOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '500px', backgroundColor: '#ffffff', border: '4px solid #111827', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.1)', overflow: 'hidden', padding: '30px', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #111827', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px' }}>FRUGALLM // QUICKSTART GUIDES</h2>
              <button onClick={() => setGuidesOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--zen-text)', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '24px', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
              Welcome to the FrugalLLM Central Hub. Select a guide below to learn how to configure your neural topology and orchestrate your AI agents:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '16px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'none', transition: 'transform 0.1s' }} onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = 'none'; }} onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111827'; }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', borderRadius: '4px' }}>1</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--zen-text)', marginBottom: '4px' }}>Defining JSON Schemas</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'sans-serif' }}>Learn how to force agents to return strict data formats.</div>
                </div>
              </div>
              
              <div style={{ padding: '16px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'none', transition: 'transform 0.1s' }} onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = 'none'; }} onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111827'; }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', borderRadius: '4px' }}>2</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--zen-text)', marginBottom: '4px' }}>Connecting Local Ollama</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'sans-serif' }}>How to run completely private models locally on port 11434.</div>
                </div>
              </div>
              
              <div style={{ padding: '16px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'none', transition: 'transform 0.1s' }} onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = 'none'; }} onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111827'; }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', borderRadius: '4px' }}>3</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--zen-text)', marginBottom: '4px' }}>Advanced OpenRouter Multiplexing</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'sans-serif' }}>Route queries dynamically to save costs and avoid rate limits.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Markdown Guide Modal */}
      {activeGuide && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setActiveGuide(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '700px', maxHeight: '80vh', backgroundColor: '#ffffff', border: '4px solid #111827', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', borderBottom: '1px solid var(--zen-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700,  fontFamily: 'inherit' }}>FRUGALLM // GUIDE</h2>
              <button onClick={() => setActiveGuide(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <div style={{ padding: '30px', overflowY: 'auto', lineHeight: 1.6, color: '#374151' }}>
              <ReactMarkdown 
                components={{
                  a: ({node, ...props}) => (
                    <a {...props} onClick={(e) => {
                      e.preventDefault();
                      if (props.href) openUrl(props.href);
                    }} style={{ color: '#ea580c', textDecoration: 'underline', cursor: 'pointer' }} />
                  ),
                  h1: ({node, ...props}) => <h1 {...props} style={{ marginTop: 0, borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }} />,
                  h2: ({node, ...props}) => <h2 {...props} style={{ marginTop: '1.5em', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }} />,
                  h3: ({node, ...props}) => <h3 {...props} style={{ marginTop: '1.2em' }} />,
                  code: ({node, className, children, ...props}: any) => {
                    const match = /language-([a-zA-Z0-9]+)/.exec(className || '')
                    return !match ? (
                      <code {...props} style={{ backgroundColor: 'var(--zen-surface-hover)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em', color: '#ea580c' }}>
                        {children}
                      </code>
                    ) : (
                      <div style={{ backgroundColor: 'var(--zen-accent)', color: '#f3f4f6', padding: '12px', borderRadius: '4px', overflowX: 'auto', marginBottom: '16px', fontFamily: 'monospace', fontSize: '0.9em' }}>
                        <code {...props}>{children}</code>
                      </div>
                    )
                  }
                }}
              >
                {GUIDES_MAP[activeGuide]}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      <ExitConfirmationModal
        isOpen={showExitModal}
        onCancel={() => setShowExitModal(false)}
        onConfirm={() => {
          invoke('confirm_exit_app').catch(console.error);
        }}
        activeServices={exitServices}
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
