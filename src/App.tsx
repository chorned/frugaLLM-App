import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { TerminalLoader } from './components/TerminalLoader';
import { useCanvasLogic } from './hooks/useCanvasLogic';
import { useProxyActivityIndicator, ProxyActivityPayload } from './hooks/useProxyActivityIndicator';
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
import { formatApiBaseUrl, copyToClipboard } from './utils/clipboard';
import ReactMarkdown from 'react-markdown';
import { StatusLight, InfoField, HardwareNode } from './components/NodeWidgets';
import {
  OpenRouterIcon,
  OllamaIcon,
  GeminiIcon,
  HermesIcon,
  OpenCodeIcon,
  FrugaLLMIcon,
  getProviderIcon,
} from './components/icons/ProviderIcons';
import { MemoryPipelineWidget } from './components/MemoryPipelineWidget';
import { MemoryProvider, useMemory } from './context/MemoryContext';
import { HardwareProfile, AVAILABLE_MODELS, GRAPH_OVERHEAD_GB } from './services/memoryCalculator';
import { CloudRoutingPanel } from './components/CloudRoutingPanel';
import { useOnboarding } from './hooks/useOnboarding';
import { useTheme } from './hooks/useTheme';
import { OnboardingDecision } from './components/OnboardingDecision';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { PortConflictBanner } from './components/PortConflictBanner';
import { ExitConfirmationModal } from './components/ExitConfirmationModal';
import { IssueReporterModal } from './components/IssueReporterModal';
import { UpdateNotification } from './components/UpdateNotification';
import { Tooltip, InfoIconSVG } from './components/Tooltip';
import en from './locales/en.json';
import { Eye, EyeOff, Copy, Check, Sun, Moon, Bug } from 'lucide-react';
import { loadOnnxClassifier, clearOnnxCache } from './services/onnxGateway';
import agentsGuide from './guides/agents.md?raw';
import ollamaGuide from './guides/ollama.md?raw';
import openrouterGuide from './guides/openrouter.md?raw';

const GUIDES_MAP: Record<string, string> = {
  agents: agentsGuide,
  ollama: ollamaGuide,
  openrouter: openrouterGuide
};

let isScreenshotMode = () => false;
let getScreenshotScreen = (): string | null => null;
let getScreenshotInitialNodes = (n: any[]) => n;
let APPSTORE_BOOT_LOGS: string[] = [];
let APPSTORE_FRUGAL_CONFIG: any = null;
let APPSTORE_FORM_DATA: any = null;
let APPSTORE_TELEMETRY: any = null;

if (import.meta.env.DEV) {
  const mod = await import('./dev/screenshotMode');
  isScreenshotMode = mod.isScreenshotMode;
  getScreenshotScreen = mod.getScreenshotScreen;
  getScreenshotInitialNodes = mod.getScreenshotInitialNodes;
  APPSTORE_BOOT_LOGS = mod.APPSTORE_BOOT_LOGS;
  APPSTORE_FRUGAL_CONFIG = mod.APPSTORE_FRUGAL_CONFIG;
  APPSTORE_FORM_DATA = mod.APPSTORE_FORM_DATA;
  APPSTORE_TELEMETRY = mod.APPSTORE_TELEMETRY;
}


const NODE_WIDTH = 220;

const CORE_NODE_HEIGHT = 140;
const PERIPHERAL_NODE_HEIGHT = 112;

const NODE_HEIGHTS: Record<string, number> = {
  'node-frugallm': CORE_NODE_HEIGHT,
  'node-ollama': PERIPHERAL_NODE_HEIGHT,
  'node-google': PERIPHERAL_NODE_HEIGHT,
  'node-openrouter': PERIPHERAL_NODE_HEIGHT,
  'node-opencode': PERIPHERAL_NODE_HEIGHT,
  'node-hermes': PERIPHERAL_NODE_HEIGHT,
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
      label: 'OpenRouter',
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
  info: <InfoIconSVG width="14" height="14" style={{ display: 'block' }} />,
  openrouter: <OpenRouterIcon size={14} />,
  ollama: <OllamaIcon size={14} />,
  gemini: <GeminiIcon size={14} />,
  hermes: <HermesIcon size={14} />,
  opencode: <OpenCodeIcon size={14} />,
};

const NodeConfigPanel = ({ node, onClose, onSave, onOpenIssueReporter, isHermesInstalled, isOpenCodeInstalled, isOllamaInstalled, isToolGatewayInstalled, detectedVram, setDetectedVram, hasActiveBackend, handleInitializeHermes, handleOpenHermes, handleUninstallHermes, handleInitializeOpenCode, handleOpenOpenCode, handleUninstallOpenCode, handleInitializeOllama, handleOpenOllama, handleUninstallOllama, handleInstallToolGateway, handleUninstallToolGateway, handleDisconnectOpenRouter, handleDisconnectGoogle, frugalConfig, handleOpenHermesGateway, handleOpenHermesDesktop, handleOpenHermesWeb, handleOpenOpenCodeWeb, activeProcesses, handleKillProcess, setFrugalConfig, latestTelemetry, hardwareProfile, portConflict }: any) => {
  const memory = useMemory();
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [showToolGatewayPrompt, setShowToolGatewayPrompt] = useState<'install' | 'uninstall' | null>(null);
  const [ipCopied, setIpCopied] = useState(false);
  const [ipCopyError, setIpCopyError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [initialEnablePassword, setInitialEnablePassword] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

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
  
  const [formData, setFormData] = useState(() => {
    if (import.meta.env.DEV && isScreenshotMode() && APPSTORE_FORM_DATA) {
      return {
        ip: node.data.ip || APPSTORE_FORM_DATA.ip,
        port: node.data.port || APPSTORE_FORM_DATA.port,
        status: node.data.status || 'active',
        schemaPath: node.data.schemaPath || APPSTORE_FORM_DATA.schemaPath,
        cwd: node.data.cwd || APPSTORE_FORM_DATA.cwd,
        bin: node.data.bin || APPSTORE_FORM_DATA.bin,
        extraArgs: node.data.extraArgs || APPSTORE_FORM_DATA.extraArgs,
        prompt: node.data.prompt || APPSTORE_FORM_DATA.prompt,
        apiKey: node.id === 'node-openrouter' ? APPSTORE_FORM_DATA.apiKey : '',
        googleApiKey: node.id === 'node-google' ? APPSTORE_FORM_DATA.googleApiKey : '',
        bind_all_interfaces: true,
        api_password: APPSTORE_FORM_DATA.api_password,
        hermes_workspace: APPSTORE_FORM_DATA.hermes_workspace,
        opencode_workspace: APPSTORE_FORM_DATA.opencode_workspace,
        start_on_login: true,
        start_minimized: false,
        global_cli_enabled: true,
        manual_model_overrides: APPSTORE_FORM_DATA.manual_model_overrides
      };
    }
    return {
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
      start_minimized: frugalConfig?.start_minimized || false,
      global_cli_enabled: false,
      manual_model_overrides: frugalConfig?.manual_model_overrides || []
    };
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
        manual_model_overrides: frugalConfig?.manual_model_overrides || []
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
        start_minimized: frugalConfig?.start_minimized || false,
        global_cli_enabled: false,
        manual_model_overrides: []
      };
      setFormData(initOther);
      setInitialData(initOther);
    }
  }, [node.id, frugalConfig]);

  const hasChanges = (() => {
    if (!initialData) return false;

    if (node.id === 'node-frugallm') {
      const portChanged = String(formData.port || '') !== String(initialData.port || '');
      const bindChanged = Boolean(formData.bind_all_interfaces) !== Boolean(initialData.bind_all_interfaces);
      const enablePassChanged = enablePassword !== initialEnablePassword;
      const passChanged = enablePassword ? (formData.api_password || '') !== (initialData.api_password || '') : false;
      const autostartChanged = Boolean(formData.start_on_login) !== Boolean(initialData.start_on_login);
      const minimizedChanged = Boolean(formData.start_minimized) !== Boolean(initialData.start_minimized);
      const overridesChanged = JSON.stringify(formData.manual_model_overrides || []) !== JSON.stringify(initialData.manual_model_overrides || []);
      return portChanged || bindChanged || enablePassChanged || passChanged || autostartChanged || minimizedChanged || overridesChanged;
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
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    try {
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
        api_password: enablePassword ? formData.api_password : '',
        manual_model_overrides: formData.manual_model_overrides
      };
      await onSave(node.id, dataToSave);
      const resetForm = {
        ...formData,
        apiKey: '',
        googleApiKey: ''
      };
      setFormData(resetForm);
      setInitialData({ ...resetForm });
      setInitialEnablePassword(enablePassword);
    } catch (err) {
      console.error('Failed to save node config:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePanelClick = (e: any) => e.stopPropagation();

  return (
    <div onClick={handlePanelClick} style={{ 
      width: node.id === 'node-frugallm' ? '780px' : '440px', 
      maxWidth: '92vw',
      maxHeight: '85vh',
      border: '1px solid var(--zen-border)', 
      backgroundColor: 'var(--zen-surface)', 
      borderRadius: '20px',
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: 'var(--zen-shadow-modal)', 
      overflow: 'hidden',
      zIndex: 100,
      fontFamily: 'inherit'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', borderBottom: '1px solid var(--zen-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getProviderIcon(node.id, { size: 18 })}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ margin: 0, color: 'var(--zen-text)', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{node.data.label}</h2>
            {node.data.subheader && (
              <span style={{ fontSize: '0.75rem', fontWeight: 450, color: 'var(--zen-text-secondary)' }}>
                {node.data.subheader}
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={onClose} 
          data-testid="node-config-close-btn"
          className="btn-cta btn-cta-icon"
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '0.9rem', 
            color: 'var(--zen-text-secondary)', 
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'; e.currentTarget.style.color = 'var(--zen-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--zen-text-secondary)'; }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ padding: '18px 20px', flexGrow: 1, backgroundColor: 'transparent', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {node.id === 'node-frugallm' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px', alignItems: 'start' }}>
              {/* Left Column: Server & System Configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>IP ADDRESS / HOST <Tooltip text="Where does this service live on the network? Usually, it's right here on your computer ('127.0.0.1' or 'localhost'), but it could be a cloud API halfway across the world!" /></label>
                    <div style={{ padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }}>
                      {formData.bind_all_interfaces ? '0.0.0.0' : (formData.ip || '127.0.0.1')}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                    <input 
                      type="text" 
                      name="port" 
                      data-testid="input-frugallm-port"
                      value={formData.port} 
                      onChange={handleChange} 
                      style={{ 
                        width: '100%', 
                        padding: '9px 14px', 
                        border: portConflict ? '1px solid #ef4444' : '1px solid var(--zen-border-input)', 
                        borderRadius: '12px', 
                        backgroundColor: 'var(--zen-surface-header)', 
                        color: 'var(--zen-text)', 
                        outline: 'none', 
                        boxSizing: 'border-box', 
                        fontFamily: 'inherit', 
                        fontWeight: 500, 
                        fontSize: '0.82rem', 
                        boxShadow: 'none' 
                      }} 
                    />
                    {portConflict && (
                      <div data-testid="port-conflict-hint" style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 500, marginTop: '4px', lineHeight: 1.2 }}>
                        Port {portConflict.port} in use: Close conflicting service and restart, or enter a new port.
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  data-testid="btn-copy-ip-port"
                  onClick={async () => {
                    const url = formatApiBaseUrl({
                      ip: formData.ip,
                      port: formData.port,
                      bind_all_interfaces: formData.bind_all_interfaces,
                    });
                    const success = await copyToClipboard(url);
                    if (success) {
                      setIpCopied(true);
                      setIpCopyError(false);
                      setTimeout(() => setIpCopied(false), 1500);
                    } else {
                      setIpCopyError(true);
                      setTimeout(() => setIpCopyError(false), 2000);
                    }
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '9px 16px', 
                    backgroundColor: ipCopied ? '#10B981' : (ipCopyError ? '#ef4444' : '#171717'), 
                    color: '#ffffff', 
                    border: 'none', 
                    borderRadius: '9999px', 
                    fontWeight: 600, 
                    fontSize: '0.78rem', 
                    cursor: 'pointer', 
                    fontFamily: 'inherit', 
                    transition: 'all 0.15s ease' 
                  }}>
                  {ipCopied ? '✓ COPIED' : (ipCopyError ? 'COPY FAILED' : 'COPY IP & PORT')}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: 'var(--zen-text)' }}>
                    <input 
                      type="checkbox" 
                      name="bind_all_interfaces" 
                      checked={formData.bind_all_interfaces} 
                      onChange={(e) => setFormData(prev => ({ ...prev, bind_all_interfaces: e.target.checked }))} 
                      style={{ borderRadius: '4px', cursor: 'pointer' }}
                    />
                    {en.routingGraph.nodeConfigPanel.inputs.bindAllInterfaces.label}
                    <Tooltip text={en.routingGraph.nodeConfigPanel.inputs.bindAllInterfaces.helpText} />
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: 'var(--zen-text)' }}>
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
                        style={{ borderRadius: '4px', cursor: 'pointer' }}
                      />
                      {en.routingGraph.nodeConfigPanel.inputs.apiPassword.checkboxLabel}
                      <Tooltip text={en.routingGraph.nodeConfigPanel.inputs.apiPassword.helpText} />
                    </label>
                    {enablePassword && formData.api_password && (
                      <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>
                        {en.routingGraph.nodeConfigPanel.inputs.apiPassword.active}
                      </span>
                    )}
                  </div>

                  {enablePassword && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="api_password" 
                        data-testid="api-password-input"
                        value={formData.api_password} 
                        onChange={handleChange} 
                        placeholder={en.routingGraph.nodeConfigPanel.inputs.apiPassword.placeholder}
                        style={{ 
                          flex: 1, 
                          padding: '9px 14px', 
                          border: '1px solid var(--zen-border-input)', 
                          borderRadius: '12px', 
                          backgroundColor: 'var(--zen-surface-header)', 
                          color: 'var(--zen-text)', 
                          outline: 'none', 
                          boxSizing: 'border-box', 
                          fontFamily: 'inherit', 
                          fontWeight: 500, 
                          fontSize: '0.82rem',
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
                          padding: '9px 12px',
                          backgroundColor: 'var(--zen-surface-hover)',
                          color: 'var(--zen-text)',
                          border: '1px solid var(--zen-border-input)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s ease'
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
                          padding: '9px 12px',
                          backgroundColor: passwordCopied ? '#10B981' : 'var(--zen-surface-hover)',
                          color: passwordCopied ? '#ffffff' : 'var(--zen-text)',
                          border: '1px solid var(--zen-border-input)',
                          borderRadius: '12px',
                          cursor: formData.api_password ? 'pointer' : 'not-allowed',
                          opacity: formData.api_password ? 1 : 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {passwordCopied ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                  )}
                </div>

                <div 
                  data-testid="settings-section-divider"
                  style={{ 
                    height: '1px', 
                    backgroundColor: 'var(--zen-border)', 
                    width: '100%' 
                  }} 
                />

                <div>
                  <Settings
                    startOnLogin={formData.start_on_login}
                    onStartOnLoginChange={(enabled) => setFormData(prev => ({ ...prev, start_on_login: enabled }))}
                    startMinimized={formData.start_minimized}
                    onStartMinimizedChange={(minimized) => setFormData(prev => ({ ...prev, start_minimized: minimized }))}
                    globalCliEnabled={formData.global_cli_enabled}
                    onGlobalCliEnabledChange={(enabled) => setFormData(prev => ({ ...prev, global_cli_enabled: enabled }))}
                    onReportIssue={onOpenIssueReporter}
                  />
                </div>
              </div>

              {/* Right Column: Global Routing Pool */}
              <div style={{ borderLeft: '1px solid var(--zen-border)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <CloudRoutingPanel 
                  overrides={formData.manual_model_overrides}
                  onOverridesChange={(newOverrides) => setFormData(prev => ({ ...prev, manual_model_overrides: newOverrides }))}
                />
              </div>
            </div>
          ) : node.data.isAgent ? (
            <>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>SCHEMA PATH <Tooltip text="Think of this as the agent's strict instruction manual. By giving it a JSON schema, we force the AI to return data in the exact structure your application expects. No more messy text—just clean data!" /></label>
                <input type="text" name="schemaPath" value={formData.schemaPath} onChange={handleChange} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>WORKING DIR (CWD) <Tooltip text="Where should the agent live while it works? This is the folder on your computer where the agent will run commands and look for files. It's basically the agent's home base." /></label>
                <input type="text" name="cwd" value={formData.cwd} onChange={handleChange} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>EXECUTABLE (BIN) <Tooltip text="Which program is actually doing the heavy lifting? This tells the system what tool to launch under the hood. Usually, it's 'agy' for our Antigravity agent, but you can plug in any CLI tool!" /></label>
                <input type="text" name="bin" value={formData.bin} onChange={handleChange} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>EXTRA ARGS (CSV) <Tooltip text="Want to tweak how the agent runs? You can pass secret flags here (like '--verbose' to see its inner thoughts). Just list them out, separated by commas." /></label>
                <input type="text" name="extraArgs" value={formData.extraArgs} onChange={handleChange} placeholder="--verbose, --force"
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>INSTRUCTION PROMPT <Tooltip text="This is your agent's main mission. Tell it exactly what you want it to accomplish. Be as specific as possible—the better the prompt, the better the results!" /></label>
                <textarea name="prompt" value={formData.prompt} onChange={handleChange} rows={2} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
            </>
          ) : (
            <>
              {node.id !== 'node-openrouter' && node.id !== 'node-google' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>IP ADDRESS / HOST <Tooltip text="Where does this service live on the network? Usually, it's right here on your computer ('127.0.0.1' or 'localhost'), but it could be a cloud API halfway across the world!" /></label>
                    {node.id === 'node-hermes' || node.id === 'node-opencode' ? (
                      <div style={{ padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }}>
                        {formData.ip}
                      </div>
                    ) : (
                      <input type="text" name="ip" value={formData.ip} onChange={handleChange} 
                        style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                    {node.id === 'node-hermes' || node.id === 'node-opencode' ? (
                      <div style={{ padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }}>
                        {formData.port}
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        name="port" 
                        data-testid="input-port"
                        value={formData.port} 
                        onChange={handleChange} 
                        style={{ 
                          width: '100%', 
                          padding: '9px 14px', 
                          border: '1px solid var(--zen-border-input)', 
                          borderRadius: '12px', 
                          backgroundColor: 'var(--zen-surface-header)', 
                          color: 'var(--zen-text)', 
                          outline: 'none', 
                          boxSizing: 'border-box', 
                          fontFamily: 'inherit', 
                          fontWeight: 500, 
                          fontSize: '0.82rem', 
                          boxShadow: 'none' 
                        }} 
                      />
                    )}
                  </div>
                </div>
              )}
              {node.id === 'node-openrouter' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>API KEY <Tooltip text="Your OpenRouter API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="apiKey" value={formData.apiKey || ''} onChange={handleChange} placeholder={Boolean(node.data.keyPrefix || node.data.status === 'active') ? en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.configuredPlaceholder : en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.placeholder}
                    style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
                </div>
              )}
              {node.id === 'node-google' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>API KEY <Tooltip text="Your Google AI Studio API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="googleApiKey" value={formData.googleApiKey || ''} onChange={handleChange} placeholder={Boolean(node.data.keyPrefix || node.data.status === 'active') ? en.routingGraph.nodeConfigPanel.inputs.googleApiKey.configuredPlaceholder : en.routingGraph.nodeConfigPanel.inputs.googleApiKey.placeholder}
                    style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
                </div>
              )}
            </>
          )}
          
        </div>
        
        {node.data.description && node.id !== 'node-ollama' ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)', marginTop: '16px', marginBottom: '0', lineHeight: 1.4, borderTop: '1px solid var(--zen-border)', paddingTop: '12px' }}>
            {node.data.description}
          </p>
        ) : null}

      {node.id === 'node-hermes' && isHermesInstalled === false && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--zen-text)', margin: 0, fontWeight: 500 }}>Please connect an intelligence source to FrugaLLM first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeHermes(); }}
              style={{ width: '100%', padding: '10px 16px', backgroundColor: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              INSTALL HERMES
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-hermes' && isHermesInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>HERMES AGENT INSTALLED</h4>
          {confirmUninstall === 'hermes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallHermes(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '4px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="hermes_workspace" value={formData.hermes_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenHermes(); }}
                style={{ width: '100%', padding: '10px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH HERMES
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); (handleOpenHermesDesktop || handleOpenHermesGateway)(); }}
                  style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                  LAUNCH APP
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenHermesWeb(); }}
                  style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
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
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '12px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zen-text)', fontWeight: 600, fontSize: '0.75rem' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                      {item.label}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleKillProcess(item.mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>CLOSE</button>
                  </div>
                ));
              })()}
              <button 
                onClick={(e) => { e.stopPropagation(); invoke('edit_hermes_soul').catch(console.error); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '9999px', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                EDIT SOUL.MD
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('hermes'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL HERMES
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-opencode' && isOpenCodeInstalled === false && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--zen-text)', margin: 0, fontWeight: 500 }}>Please connect an intelligence source to FrugaLLM first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeOpenCode(); }}
              style={{ width: '100%', padding: '10px 16px', backgroundColor: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              INSTALL OPENCODE
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-opencode' && isOpenCodeInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>OPENCODE AGENT INSTALLED</h4>
          {confirmUninstall === 'opencode' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOpenCode(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '4px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="opencode_workspace" value={formData.opencode_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCode(); }}
                style={{ width: '100%', padding: '10px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH OPENCODE
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCodeWeb(); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                LAUNCH WEBUI
              </button>
              {['run-opencode', 'run-opencode-web'].map(mode => activeProcesses && activeProcesses[mode] && (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '12px', marginBottom: '4px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zen-text)', fontWeight: 600, fontSize: '0.75rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                    {mode.replace('run-', '').toUpperCase()} ACTIVE
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleKillProcess(mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>CLOSE</button>
                </div>
              ))}
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('opencode'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL OPENCODE
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-ollama' && isOllamaInstalled === false && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px' }}>VRAM DETECTED (GB) <Tooltip text="We tried to auto-detect your Video RAM, but you can correct this if it's wrong." /></label>
            <input 
              type="text" 
              value={detectedVram} 
              onChange={(e) => {
                setDetectedVram(e.target.value);
                const num = Number(e.target.value) || 0;
                if (num > 0) memory.setDetectedVramGb(num);
              }}
              data-testid="vram-detected-input"
              style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }} 
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px' }}>RECOMMENDED MODEL <Tooltip text="Based on your VRAM, we'll pull this model for you!" /></label>
            <select 
              value={memory.activeModelName} 
              onChange={(e) => memory.setActiveModelName(e.target.value)}
              data-testid="recommended-model-input"
              style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }} 
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
            style={{ width: '100%', padding: '10px 16px', backgroundColor: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease' }}>
            INSTALL OLLAMA
          </button>
        </div>
      )}
      
      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>OLLAMA INSTALLED</h4>
          
          <div style={{ marginBottom: '12px' }}>
            <MemoryPipelineWidget 
              modelTag={latestTelemetry?.ollama?.model_name || memory.activeModelName} 
              segments={memory.effectiveSegments} 
              hardwareProfile={hardwareProfile || memory.hardwareProfile || latestTelemetry?.hardware_profile} 
            />
          </div>
          {confirmUninstall === 'ollama' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOllama(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOllama(); }}
                style={{ width: '100%', padding: '10px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                CHAT WITH OLLAMA
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('ollama'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL OLLAMA
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.02em' }}>
              {en.routingGraph.nodeConfigPanel.actions.toolGateway.title}
            </h4>
            <span 
              data-testid="tool-gateway-status"
              style={{ 
              fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', borderRadius: '9999px',
              backgroundColor: isToolGatewayInstalled ? '#dcfce7' : '#F4F4F5',
              color: isToolGatewayInstalled ? '#15803d' : 'var(--zen-text-secondary)',
              border: `1px solid ${isToolGatewayInstalled ? '#86efac' : 'var(--zen-border)'}`
            }}>
              {isToolGatewayInstalled ? en.routingGraph.nodeConfigPanel.actions.toolGateway.installed : en.routingGraph.nodeConfigPanel.actions.toolGateway.notInstalled}
            </span>
          </div>

          <p style={{ margin: '0 0 10px 0', fontSize: '0.72rem', color: 'var(--zen-text-secondary)', lineHeight: '1.35' }}>
            {en.routingGraph.nodeConfigPanel.actions.toolGateway.description}
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: 'var(--zen-text)', userSelect: 'none' }}>
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
              style={{ width: '15px', height: '15px', cursor: 'pointer', borderRadius: '4px', accentColor: '#10B981' }}
            />
            <span>{en.routingGraph.nodeConfigPanel.actions.toolGateway.checkboxLabel}</span>
          </label>

          {showToolGatewayPrompt === 'install' && (
            <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.installPromptTitle}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--zen-text-secondary)', lineHeight: '1.3' }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.installPromptText}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button 
                  data-testid="confirm-install-tool-gateway"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                    handleInstallToolGateway();
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-accent)', color: '#ffffff', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.installButton}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.cancelButton}
                </button>
              </div>
            </div>
          )}

          {showToolGatewayPrompt === 'uninstall' && (
            <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallPromptTitle}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--zen-text-secondary)', lineHeight: '1.3' }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallPromptText}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button 
                  data-testid="confirm-uninstall-tool-gateway"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                    handleUninstallToolGateway();
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallButton}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.cancelButton}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {node.id === 'node-openrouter' && Boolean(node.data.keyPrefix || node.data.status === 'active') && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>OPENROUTER CONNECTED</h4>
          {confirmUninstall === 'openrouter' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectOpenRouter(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('openrouter'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-google' && Boolean(node.data.keyPrefix || node.data.status === 'active') && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>GOOGLE AI STUDIO CONNECTED</h4>
          {confirmUninstall === 'google' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectGoogle(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('google'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}
      </div>
      
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--zen-border)', backgroundColor: 'var(--zen-surface)', display: 'flex', gap: '8px' }}>
        <button 
          onClick={handleSave} 
          disabled={!hasChanges || isSaving}
          data-testid="save-node-config-button"
          className={`btn-cta ${hasChanges && !isSaving ? 'btn-cta-primary' : 'btn-cta-secondary'}`}
          style={{ 
            flex: 1, 
            padding: '11px 20px', 
            backgroundColor: hasChanges && !isSaving ? 'var(--zen-accent)' : 'var(--zen-pill-bg)', 
            color: hasChanges && !isSaving ? '#FFFFFF' : 'var(--zen-text-secondary)', 
            border: hasChanges && !isSaving ? 'none' : '1px solid var(--zen-pill-border)', 
            borderRadius: '9999px', 
            fontWeight: 600, 
            fontSize: '0.85rem', 
            cursor: hasChanges && !isSaving ? 'pointer' : 'not-allowed', 
            opacity: 1,
            fontFamily: 'inherit', 
            boxShadow: hasChanges && !isSaving ? 'var(--zen-active-glow)' : 'none', 
          }}
          onMouseDown={e => { 
            if (hasChanges && !isSaving) {
              e.currentTarget.style.transform = 'scale(0.99)'; 
            }
          }}
          onMouseUp={e => { 
            if (hasChanges && !isSaving) {
              e.currentTarget.style.transform = 'none'; 
            }
          }}
        >
          {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
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
        const cliPathEnv = 'export PATH="$HOME/.local/bin:$HOME/.hermes/bin:$HOME/.opencode/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"';
        const resolveHermesBin = 'HERMES_BIN="$(command -v hermes 2>/dev/null || ([ -x "$HOME/.local/bin/hermes" ] && echo "$HOME/.local/bin/hermes") || ([ -x "$HOME/.hermes/bin/hermes" ] && echo "$HOME/.hermes/bin/hermes") || ([ -x "$HOME/.cargo/bin/hermes" ] && echo "$HOME/.cargo/bin/hermes") || echo "hermes")"';
        const resolveOpenCodeBin = 'OPENCODE_BIN="$(command -v opencode 2>/dev/null || ([ -x "$HOME/.local/bin/opencode" ] && echo "$HOME/.local/bin/opencode") || ([ -x "$HOME/.opencode/bin/opencode" ] && echo "$HOME/.opencode/bin/opencode") || ([ -x "$HOME/.cargo/bin/opencode" ] && echo "$HOME/.cargo/bin/opencode") || echo "opencode")"';
        
        if (mode === 'run-opencode') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveOpenCodeBin} && ${frugalEnv} && "$OPENCODE_BIN" -m litellm/frugallm`] });
        } else if (mode === 'run-opencode-web') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveOpenCodeBin} && ${frugalEnv} && "$OPENCODE_BIN" web`] });
        } else if (mode === 'run-ollama') {
          let targetModel = 'frugallm-active';
          try {
            const resolved = await invoke<string>('get_ollama_chat_model');
            if (resolved) targetModel = resolved;
          } catch (err) {
            console.warn('Unable to resolve dynamic ollama chat model:', err);
          }
          await invoke('spawn_pty', { 
            sessionId, 
            command: 'bash', 
            args: ['-c', `export TERM=xterm-256color && export PATH="/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Applications/Ollama.app/Contents/Resources:$PATH" && ${frugalEnv} && TARGET_MODEL="${targetModel}" && if ! ollama list 2>/dev/null | grep -q "^$TARGET_MODEL"; then FALLBACK="$(ollama list 2>/dev/null | awk 'NR>1 {print $1}' | head -n 1)"; if [ -n "$FALLBACK" ]; then TARGET_MODEL="$FALLBACK"; fi; fi && ollama run "$TARGET_MODEL"`] 
          });
        } else if (mode === 'run-hermes-web') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN" dashboard --host 127.0.0.1`] });
        } else if (mode === 'run-hermes-desktop') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN" desktop`] });
        } else if (mode === 'run-hermes-gateway') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN" gateway --host 127.0.0.1`] });
        } else {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN"`] });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getProviderIcon(mode, { size: 16 })}
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--zen-text)', margin: 0 }}>
            {title}
          </h2>
        </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              onClick={() => onExit()}
              title="Hide terminal and keep process running in background"
              aria-label="Hide terminal"
              style={{ 
                background: 'none', 
                border: '1px solid var(--zen-border)', 
                borderRadius: '6px', 
                padding: 0,
                width: '26px',
                height: '26px',
                cursor: 'pointer', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                color: 'var(--zen-text)', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)';
                e.currentTarget.style.borderColor = 'var(--zen-border-input)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--zen-border)';
              }}
            >
              <span style={{ display: 'inline-block', transform: 'translateY(-2px)' }}>_</span>
              <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>HIDE</span>
            </button>
            <button 
              onClick={() => setShowConfirmClose(true)}
              title="Close process"
              aria-label="✕"
              style={{ 
                background: 'none', 
                border: '1px solid var(--zen-border)', 
                borderRadius: '6px', 
                padding: 0,
                width: '26px',
                height: '26px',
                cursor: 'pointer', 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                color: 'var(--zen-text)', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)';
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--zen-text)';
                e.currentTarget.style.borderColor = 'var(--zen-border)';
              }}
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
  const [isHermesInstalled, setIsHermesInstalled] = useState<boolean | null>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return null;
  });
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState<boolean | null>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return null;
  });
  const [hermesVersion, setHermesVersion] = useState<string>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return 'v0.4.2';
    return 'N/A';
  });
  const [opencodeVersion, setOpencodeVersion] = useState<string>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return 'v1.2.0';
    return 'N/A';
  });
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean | null>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return null;
  });
  const [isToolGatewayInstalled, setIsToolGatewayInstalled] = useState<boolean | null>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return true;
    return null;
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

      addLog("Checking provider health statuses...");
      try {
        const statuses = await invoke<Record<string, string>>('get_provider_statuses');
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
    const unlistenProviderStatus = listen('provider_status', (event: any) => {
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
    });
    return () => {
      unlistenConfig.then(f => f());
      unlistenError.then(f => f());
      unlistenStatus.then(f => f());
      unlistenProviderStatus.then(f => f());
    };
  }, []);

  useEffect(() => {
    // Resize observer logic moved to useCanvasLogic
  }, [terminalMode]);

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

  // UI State
  const [portConflict, setPortConflict] = useState<{ port: number; message: string } | null>(null);
  const [detectedVram, setDetectedVram] = useState<string>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return '16';
    return '8';
  });
  const [latestTelemetry, setLatestTelemetry] = useState<any>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return APPSTORE_TELEMETRY;
    return null;
  });
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(() => {
    if (import.meta.env.DEV && isScreenshotMode()) return (APPSTORE_TELEMETRY as any)?.hardware_profile;
    return null;
  });

  const { activeProxyState, handleProxyActivityEvent, cleanup: cleanupProxyIndicator } = useProxyActivityIndicator();

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
    listen<ProxyActivityPayload>('proxy_activity', (event) => {
      handleProxyActivityEvent(event.payload);
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
      cleanupProxyIndicator();
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
        if (finalConfig.manual_model_overrides !== undefined) {
          await invoke('set_model_override', { overrides: finalConfig.manual_model_overrides });
          await invoke('refresh_routing_chain').catch(console.error);
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
        await invoke('set_credential', { service: 'google', secret: finalConfig.googleApiKey });
        await invoke('refresh_routing_chain').catch(console.error);
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
        await invoke('set_credential', { service: 'openrouter', secret: finalConfig.apiKey });
        await invoke('refresh_routing_chain').catch(console.error);
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

  interface SvgLineCoord {
    id: string;
    sourceId: string;
    targetId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isActive: boolean;
  }

  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const centralNodeRef = useRef<HTMLDivElement | null>(null);
  const outerNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [lines, setLines] = useState<SvgLineCoord[]>([]);

  const calculateLines = useCallback(() => {
    const container = mainContainerRef.current;
    const centralEl = centralNodeRef.current;
    if (!container || !centralEl) return;

    const containerRect = container.getBoundingClientRect();
    const isZeroSize = containerRect.width === 0 && containerRect.height === 0;

    const scaleX = (!isZeroSize && container.offsetWidth > 0) ? (containerRect.width / container.offsetWidth) : 1;
    const scaleY = (!isZeroSize && container.offsetHeight > 0) ? (containerRect.height / container.offsetHeight) : 1;

    const getCenter = (el: HTMLElement | null, fallbackCoord: { x: number; y: number }) => {
      if (!el) return fallbackCoord;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        return fallbackCoord;
      }
      return {
        x: ((r.left + r.width / 2) - containerRect.left) / scaleX,
        y: ((r.top + r.height / 2) - containerRect.top) / scaleY,
      };
    };

    const defaultFallback: Record<string, { x: number; y: number }> = {
      'node-ollama': { x: 140, y: 70 },
      'node-google': { x: 500, y: 70 },
      'node-openrouter': { x: 860, y: 70 },
      'node-frugallm': { x: 500, y: 300 },
      'node-opencode': { x: 300, y: 530 },
      'node-hermes': { x: 700, y: 530 },
    };

    const centralCenter = getCenter(centralEl, defaultFallback['node-frugallm']);

    const computedLines: SvgLineCoord[] = [];

    for (const edge of initialEdges) {
      const isCentralSource = edge.source === 'node-frugallm';
      const outerId = isCentralSource ? edge.target : edge.source;
      const outerEl = outerNodeRefs.current[outerId];
      const outerCenter = getCenter(outerEl, defaultFallback[outerId] || { x: 0, y: 0 });

      let isActive = false;
      if (edge.id === 'edge-hermes-frugallm') {
        isActive = activeProxyState?.source === 'hermes' || !!activeProcesses['run-hermes'] || !!activeProcesses['run-hermes-gateway'];
      } else if (edge.id === 'edge-opencode-frugallm') {
        isActive = activeProxyState?.source === 'opencode' || !!activeProcesses['run-opencode'];
      } else if (edge.id === 'edge-frugallm-ollama') {
        isActive = activeProxyState?.target === 'ollama' || terminalMode === 'run-ollama';
      } else if (edge.id === 'edge-frugallm-openrouter') {
        isActive = activeProxyState?.target === 'openrouter';
      } else if (edge.id === 'edge-frugallm-google') {
        isActive = activeProxyState?.target === 'google';
      }

      const sx = isCentralSource ? centralCenter.x : outerCenter.x;
      const sy = isCentralSource ? centralCenter.y : outerCenter.y;
      const tx = isCentralSource ? outerCenter.x : centralCenter.x;
      const ty = isCentralSource ? outerCenter.y : centralCenter.y;

      computedLines.push({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        x1: sx,
        y1: sy,
        x2: tx,
        y2: ty,
        isActive,
      });
    }

    setLines(prev => {
      if (
        prev.length === computedLines.length &&
        prev.every((p, i) => {
          const c = computedLines[i];
          return (
            p.id === c.id &&
            Math.abs(p.x1 - c.x1) < 0.5 &&
            Math.abs(p.y1 - c.y1) < 0.5 &&
            Math.abs(p.x2 - c.x2) < 0.5 &&
            Math.abs(p.y2 - c.y2) < 0.5 &&
            p.isActive === c.isActive
          );
        })
      ) {
        return prev;
      }
      return computedLines;
    });
  }, [activeProxyState, activeProcesses, terminalMode]);

  const handleToggleTheme = useCallback(() => {
    toggleTheme();
    calculateLines();
    setTimeout(() => {
      calculateLines();
    }, 50);
  }, [toggleTheme, calculateLines]);

  useLayoutEffect(() => {
    calculateLines();
  }, [calculateLines, nodes, portConflict, isAppLoaded, theme]);

  useEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    const mountTimer = setTimeout(() => {
      calculateLines();
    }, 50);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        calculateLines();
      });
      ro.observe(container);
    }

    window.addEventListener('resize', calculateLines);

    return () => {
      clearTimeout(mountTimer);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', calculateLines);
    };
  }, [calculateLines, nodes, portConflict, terminalMode, isAppLoaded, theme]);

  const topNodes = ['node-ollama', 'node-google', 'node-openrouter']
    .map(id => nodes.find(n => n.id === id))
    .filter(Boolean) as AppNode[];

  const centralNode = nodes.find(n => n.id === 'node-frugallm');

  const bottomNodes = ['node-opencode', 'node-hermes']
    .map(id => nodes.find(n => n.id === id))
    .filter(Boolean) as AppNode[];

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const hasActiveBackend = nodes.some(n => (n.id === 'node-ollama' || n.id === 'node-openrouter' || n.id === 'node-google') && n.data.status === 'active');

  const renderNode = (node: AppNode) => {
    const isSelected = selectedNodeId === node.id;
    const isCore = node.id === 'node-frugallm';
    const nodeH = (isCore && portConflict) ? 176 : (NODE_HEIGHTS[node.id] || PERIPHERAL_NODE_HEIGHT);

    let stateColors = {
      border: isCore && portConflict ? '#ef4444' : 'transparent',
      headerBg: isCore && portConflict ? '#fef2f2' : (isSelected ? 'var(--zen-surface-header-active)' : 'var(--zen-surface-header)'), 
      headerText: isCore && portConflict ? '#991b1b' : 'var(--zen-text)',
      bodyBg: 'var(--zen-surface)',
      dot: isCore && portConflict ? '#ef4444' : '#10B981',
      statusText: 'var(--zen-text-secondary)',
      boxShadow: isCore && portConflict ? '0 0 16px rgba(239, 68, 68, 0.2), var(--zen-shadow-diffused)' : 'var(--zen-shadow-diffused)',
      borderStyle: 'none',
      borderWidth: '0px'
    };

    let Icon: React.ReactNode = Icons.cpu;
    const providerIcon = getProviderIcon(node.id, { size: 14 });
    if (providerIcon) {
      Icon = providerIcon;
    } else if (node.data.isAgent) {
      Icon = Icons.agent;
    }

    const setNodeRef = (el: HTMLDivElement | null) => {
      if (isCore) {
        centralNodeRef.current = el;
      } else {
        outerNodeRefs.current[node.id] = el;
      }
    };

    if (node.id === 'node-ollama') {
      const isOllamaGenerating = activeProxyState?.target === 'ollama' || terminalMode === 'run-ollama';
      return (
        <div
          key={node.id}
          id={node.id}
          data-node-id={node.id}
          ref={setNodeRef}
          className={`retro-node ${isSelected ? 'selected' : ''}`.trim()}
          style={{ 
            position: 'relative',
            width: NODE_WIDTH, 
            height: nodeH,
            boxSizing: 'border-box',
            zIndex: isSelected ? 5 : 1,
            backgroundColor: 'var(--zen-surface)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: isSelected ? '0 0 0 2px var(--zen-active-border), var(--zen-active-glow), var(--zen-shadow-diffused)' : 'var(--zen-shadow-diffused)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            userSelect: 'none',
            overflow: 'hidden'
          }}
          onMouseDown={(e) => handleCanvasMouseDown(e)}
          onClick={(e) => handleNodeClick(e, node.id)}
        >
          <HardwareNode 
            isGenerating={isOllamaGenerating} 
            label={node.data.label} 
            subheader={node.data.subheader} 
            icon={<OllamaIcon size={14} />} 
            isSelected={isSelected} 
            lastStatus={node.data.lastStatus}
          />
        </div>
      );
    }

    return (
      <div 
        key={node.id}
        id={node.id}
        data-node-id={node.id}
        ref={setNodeRef}
        className={`retro-node ${isSelected ? 'selected' : ''}`.trim()}
        style={{
          position: 'relative',
          width: NODE_WIDTH,
          height: nodeH,
          boxSizing: 'border-box',
          cursor: 'pointer',
          backgroundColor: stateColors.bodyBg,
          border: 'none',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: isSelected ? `0 0 0 2px var(--zen-active-border), var(--zen-active-glow), ${stateColors.boxShadow}` : stateColors.boxShadow,
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
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {Icon}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: stateColors.headerText, letterSpacing: '0.02em' }}>
                {node.data.label}
              </span>
              {node.data.subheader && (
                <span style={{ fontWeight: 450, fontSize: '0.65rem', color: 'var(--zen-text-secondary)' }}>
                  {node.data.subheader}
                </span>
              )}
            </div>
            {isCore && portConflict && (
              <span
                data-testid="frugallm-port-conflict-badge"
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '9999px',
                  letterSpacing: '0.04em'
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
                color: 'var(--zen-text)',
                padding: '4px',
                borderRadius: '9999px',
                opacity: 0.8
              }}
            >
              {Icons.settings}
            </div>
          </div>
        </div>
        
        {/* Body */}
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: stateColors.bodyBg, color: 'var(--zen-text)' }}>
          {isCore ? (
            <>
              {portConflict && (
                <div
                  data-testid="frugallm-node-conflict-warning"
                  style={{
                    backgroundColor: '#fee2e2',
                    border: 'none',
                    color: '#991b1b',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}
                >
                  Port {portConflict.port} Conflict
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Session tokens:</span>
                <span data-testid="frugallm-session-tokens" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                  {((frugalConfig?.input_tokens_session || 0) + (frugalConfig?.output_tokens_session || 0)).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Total tokens:</span>
                <span data-testid="frugallm-total-tokens" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                  {((frugalConfig?.input_tokens_lifetime || 0) + (frugalConfig?.output_tokens_lifetime || 0)).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>$ Saved:</span>
                <span data-testid="frugallm-money-saved" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#10B981' }}>
                  ${((((frugalConfig?.input_tokens_lifetime || 0) * 3.0) + ((frugalConfig?.output_tokens_lifetime || 0) * 15.0)) / 1_000_000).toFixed(2)}
                </span>
              </div>
            </>
          ) : (node.id === 'node-openrouter' || node.id === 'node-google') ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>API Key</span>
                {Boolean(node.data.keyPrefix || node.data.status === 'active') ? (
                  <span data-testid={`${node.id}-api-key`} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--zen-text)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
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
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: 'var(--zen-text)',
                      textDecoration: 'underline',
                      cursor: 'pointer'
                    }}
                  >
                    Get key
                  </a>
                )}
              </div>
              {(() => {
                const rawStatus = node.data.lastStatus;
                const isRateLimited = !!rawStatus && /429/i.test(rawStatus);
                const isHardError = !!rawStatus && (/4\d\d|5\d\d|error|timeout|offline/i.test(rawStatus) && !isRateLimited);
                const isSuccess = !!rawStatus && (rawStatus === '200 OK' || /^2\d\d$/i.test(rawStatus) || /200/i.test(rawStatus));
                
                const statusText = rawStatus || (node.data.status === 'active' ? 'Standby' : 'N/A');
                const statusColor = isRateLimited
                  ? '#eab308' // Yellow: Rate limited / cooldown
                  : isHardError
                    ? '#ef4444' // Red: Hard blocked (403), 5xx, or network failure
                    : isSuccess
                      ? '#10B981' // Green: 200 OK healthy
                      : (node.data.status === 'active')
                        ? '#eab308' // Standby / pending verification
                        : 'var(--zen-text-secondary)';
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Status</span>
                    <span data-testid={`${node.id}-status`} style={{ fontSize: '0.78rem', fontWeight: 500, color: statusColor }}>
                      {statusText}
                    </span>
                  </div>
                );
              })()}
            </>
          ) : (node.id === 'node-hermes' || node.id === 'node-opencode') ? (
            (() => {
              const isHermes = node.id === 'node-hermes';
              const isInstalled = isHermes ? isHermesInstalled : isOpenCodeInstalled;
              const isRunning = isHermes 
                ? !!(activeProcesses['run-hermes'] || activeProcesses['run-hermes-gateway'] || activeProcesses['run-hermes-desktop'] || activeProcesses['run-hermes-web'] || activeProcesses['hermes-gateway'] || activeProcesses['hermes-dashboard'] || node.data.status === 'active')
                : !!(activeProcesses['run-opencode'] || activeProcesses['run-opencode-web'] || node.data.status === 'active');
              
              const statusText = !isInstalled ? 'N/A' : (isRunning ? 'Active' : 'Standby');
              const statusColor = !isInstalled ? 'var(--zen-text-secondary)' : (isRunning ? '#10B981' : '#eab308');
              const versionText = !isInstalled ? 'N/A' : (isHermes ? hermesVersion : opencodeVersion);

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Status:</span>
                    <span data-testid={`${node.id}-status`} style={{ fontSize: '0.78rem', fontWeight: 500, color: statusColor }}>
                      {statusText}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)', flexShrink: 0 }}>Version:</span>
                    <span data-testid={`${node.id}-version`} style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--zen-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={versionText}>
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
  };

  if (!isLoaded) return null;

  return !isAppLoaded ? <TerminalLoader logs={initLogs} theme={theme} /> : (
    <div 
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', fontFamily: 'inherit', backgroundColor: 'var(--zen-canvas)', backgroundImage: 'var(--zen-canvas-texture)', overflow: 'hidden', overscrollBehavior: 'none' }}
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
          @keyframes flowAnimation {
            to {
              stroke-dashoffset: -16;
            }
          }
          .edge-stream-forward {
            animation: streamForward 0.8s linear infinite;
          }
          .edge-stream-reverse {
            animation: streamReverse 1.1s linear infinite;
          }
          .edge-flow-active {
            animation: flowAnimation 0.8s linear infinite;
          }
          .retro-node {
            transition: box-shadow 0.2s ease, border-color 0.2s ease;
            --node-card-shadow: var(--zen-shadow-diffused);
          }
          .retro-node:hover {
            --node-card-shadow: var(--zen-shadow-card-hover);
            box-shadow: var(--zen-shadow-card-hover) !important;
          }
          .retro-node.selected:hover {
            --node-card-shadow: var(--zen-shadow-card-selected-hover);
            box-shadow: var(--zen-shadow-card-selected-hover) !important;
          }
          .terminal-drawer {
            transition: transform 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
          }
        `}
      </style>

      {/* Header */}
      <header 
        ref={headerRef}
        data-testid="app-header" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '10px 20px', 
          backgroundColor: 'var(--zen-header-bg)', 
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--zen-header-border)',
          flexShrink: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FrugaLLMIcon 
            size={22} 
            title="FrugaLLM Logo"
            aria-label="FrugaLLM Logo"
            data-testid="header-frugallm-icon"
            style={{ color: 'var(--zen-text)', flexShrink: 0 }} 
          />
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--zen-text)', letterSpacing: '-0.01em' }}>
            {en.header?.brandName || 'FrugaLLM'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleToggleTheme}
            data-testid="header-theme-toggle-btn"
            className="btn-cta btn-cta-icon"
            aria-label={en.header?.toggleTheme || "Toggle theme"}
            role="button"
            title={isDark ? (en.header?.themeLight || "Switch to light theme") : (en.header?.themeDark || "Switch to dark theme")}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 0,
              backgroundColor: 'var(--zen-pill-bg)',
              border: '1px solid var(--zen-pill-border)',
              borderRadius: '9999px',
              color: 'var(--zen-text)',
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={() => setGuidesOpen(true)}
            data-testid="header-guides-btn"
            className="btn-cta btn-cta-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              border: '1px solid var(--zen-border-subtle)',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--zen-text)',
              fontFamily: 'inherit',
            }}
          >
            {en.footer?.guides || 'Quickstart Guides'}
          </button>
        </div>
      </header>

      {/* Canvas Area */}
      {(['install-hermes', 'run-hermes', 'run-hermes-web', 'run-hermes-gateway', 'run-hermes-desktop', 'install-opencode', 'run-opencode', 'run-opencode-web', 'install-ollama', 'run-ollama', 'install-tool-gateway', 'uninstall-tool-gateway'] as const).map((mode) => {
        const isActive = activeProcesses[mode] || terminalMode === mode;
        if (!isActive) return null;
        return (
          <div key={mode} style={{ display: terminalMode === mode ? 'flex' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 50, backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)' }}>
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
            display: terminalMode ? 'none' : 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overscrollBehavior: 'none',
            minHeight: 0,
            overflow: 'hidden'
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
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${autoScale}) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          pointerEvents: 'none'
        }}>
          {/* Main Relative Container for 3-Row Flexbox Router */}
          <div
            ref={mainContainerRef}
            data-testid="router-main-container"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1100px',
              height: '100%',
              maxHeight: '660px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px 32px',
              boxSizing: 'border-box',
              pointerEvents: 'auto'
            }}
          >
            {/* Dynamic SVG Routing Layer */}
            <svg
              data-testid="router-svg-layer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
                overflow: 'visible'
              }}
            >
              {lines.map((line) => (
                <line
                  key={line.id}
                  id={line.id}
                  data-testid={`svg-line-${line.id}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={line.isActive ? "var(--zen-accent)" : "var(--zen-edge)"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={line.isActive ? 8 : undefined}
                  className={line.isActive ? "edge-flow-active" : ""}
                  style={line.isActive ? { strokeDasharray: '8', animation: 'flowAnimation 0.8s linear infinite', transition: 'stroke 0.2s ease, opacity 0.2s ease' } : { transition: 'stroke 0.2s ease, opacity 0.2s ease' }}
                />
              ))}
            </svg>

            {/* Top Row (3 nodes) */}
            <div
              data-testid="router-top-row"
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                zIndex: 10,
                flex: 1
              }}
            >
              {topNodes.map(renderNode)}
            </div>

            {/* Middle Row (1 central router node) */}
            <div
              data-testid="router-middle-row"
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                flex: 1
              }}
            >
              {centralNode && renderNode(centralNode)}
            </div>

            {/* Bottom Row (2 nodes) */}
            <div
              data-testid="router-bottom-row"
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-around',
                alignItems: 'flex-end',
                paddingLeft: '11%',
                paddingRight: '11%',
                boxSizing: 'border-box',
                zIndex: 10,
                flex: 1
              }}
            >
              {bottomNodes.map(renderNode)}
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer 
        data-testid="app-footer" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '10px 20px', 
          backgroundColor: 'var(--zen-footer-bg)', 
          borderTop: '1px solid var(--zen-footer-border)',
          flexShrink: 0,
          zIndex: 10,
          fontSize: '0.75rem',
          color: 'var(--zen-text-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <a 
            href="#docs" 
            data-testid="footer-link-docs"
            onClick={(e) => { e.preventDefault(); }} 
            style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
          >
            {en.footer?.documentation || 'Documentation'}
          </a>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noreferrer"
            data-testid="footer-link-github"
            onClick={(e) => { e.preventDefault(); openUrl('https://github.com').catch(() => {}); }} 
            style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
          >
            {en.footer?.github || 'GitHub'}
          </a>
          <a 
            href="#guides" 
            data-testid="footer-link-guides"
            onClick={(e) => { e.preventDefault(); setGuidesOpen(true); }} 
            style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
          >
            {en.footer?.guides || 'Quickstart Guides'}
          </a>
          <a 
            href="#privacy" 
            data-testid="footer-link-privacy"
            onClick={(e) => { e.preventDefault(); }} 
            style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
          >
            {en.footer?.privacy || 'Privacy & Telemetry'}
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UpdateNotification />
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
          <span style={{ fontWeight: 500, color: 'var(--zen-text-secondary)' }}>{en.footer?.status || 'System Ready'}</span>
        </div>
      </footer>
      {/* Settings Modal */}
      {selectedNode && !terminalMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedNodeId(null)}>
          <NodeConfigPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} onSave={handleSaveNodeConfig} onOpenIssueReporter={() => setIsIssueReporterOpen(true)} onOpenGuide={setActiveGuide} isHermesInstalled={isHermesInstalled} isOpenCodeInstalled={isOpenCodeInstalled} isOllamaInstalled={isOllamaInstalled} isToolGatewayInstalled={isToolGatewayInstalled} detectedVram={detectedVram} setDetectedVram={setDetectedVram} hasActiveBackend={hasActiveBackend} handleInitializeHermes={handleInitializeHermes} handleOpenHermes={handleOpenHermes} handleUninstallHermes={handleUninstallHermes} handleInitializeOpenCode={handleInitializeOpenCode} handleOpenOpenCode={handleOpenOpenCode} handleUninstallOpenCode={handleUninstallOpenCode} handleInitializeOllama={handleInitializeOllama} handleOpenOllama={handleOpenOllama} handleUninstallOllama={handleUninstallOllama} handleInstallToolGateway={handleInstallToolGateway} handleUninstallToolGateway={handleUninstallToolGateway} handleDisconnectOpenRouter={handleDisconnectOpenRouter} handleDisconnectGoogle={handleDisconnectGoogle} frugalConfig={frugalConfig} setFrugalConfig={setFrugalConfig} handleOpenHermesGateway={handleOpenHermesGateway} handleOpenHermesDesktop={handleOpenHermesDesktop} handleOpenHermesWeb={handleOpenHermesWeb} handleOpenOpenCodeWeb={handleOpenOpenCodeWeb} activeProcesses={activeProcesses} handleKillProcess={handleKillProcess} latestTelemetry={latestTelemetry} hardwareProfile={hardwareProfile} portConflict={portConflict} />
        </div>
      )}

      {/* Guides Modal */}
      {guidesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setGuidesOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '520px', backgroundColor: 'var(--zen-surface)', border: 'none', borderRadius: '20px', boxShadow: 'var(--zen-shadow-modal)', overflow: 'hidden', padding: '28px', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: 'none', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--zen-text)' }}>FRUGALLM // QUICKSTART GUIDES</h2>
              <button onClick={() => setGuidesOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--zen-text-secondary)', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--zen-text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Welcome to the FrugalLLM Central Hub. Select a guide below to learn how to configure your neural topology and orchestrate your AI agents:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', backgroundColor: 'var(--zen-surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background-color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'}>
                <div style={{ width: '28px', height: '28px', backgroundColor: '#171717', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '0.85rem', borderRadius: '9999px' }}>1</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--zen-text)', marginBottom: '2px' }}>Defining JSON Schemas</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)' }}>Learn how to force agents to return strict data formats.</div>
                </div>
              </div>
              
              <div style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', backgroundColor: 'var(--zen-surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background-color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'}>
                <div style={{ width: '28px', height: '28px', backgroundColor: '#171717', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '0.85rem', borderRadius: '9999px' }}>2</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--zen-text)', marginBottom: '2px' }}>Connecting Local Ollama</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)' }}>How to run completely private models locally on port 11434.</div>
                </div>
              </div>
              
              <div style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', backgroundColor: 'var(--zen-surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background-color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'}>
                <div style={{ width: '28px', height: '28px', backgroundColor: '#171717', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '0.85rem', borderRadius: '9999px' }}>3</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--zen-text)', marginBottom: '2px' }}>Advanced OpenRouter Multiplexing</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)' }}>Route queries dynamically to save costs and avoid rate limits.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Markdown Guide Modal */}
      {activeGuide && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setActiveGuide(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '700px', maxHeight: '80vh', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '20px', boxShadow: 'var(--zen-shadow-modal)', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', borderBottom: '1px solid var(--zen-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700,  fontFamily: 'inherit' }}>FRUGALLM // GUIDE</h2>
              <button onClick={() => setActiveGuide(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--zen-text-secondary)', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <div style={{ padding: '30px', overflowY: 'auto', lineHeight: 1.6, color: 'var(--zen-text)' }}>
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

      {/* Issue Reporter Modal */}
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
