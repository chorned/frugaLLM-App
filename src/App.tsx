import { useState, useEffect, useRef } from 'react';
import { TerminalLoader } from './components/TerminalLoader';
import { useCanvasLogic } from './hooks/useCanvasLogic';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
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
import { StatusLight, CopyableField, InfoField, HardwareNode } from './components/NodeWidgets';
import { CloudRoutingPanel } from './components/CloudRoutingPanel';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingDecision } from './components/OnboardingDecision';
import { OnboardingOverlay } from './components/OnboardingOverlay';
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
      label: 'OLLAMA LOCAL', 
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
      label: 'OPENROUTER',
      description: '',
      ip: 'openrouter.ai',
      status: 'needs_activation'
    }
  },
  {
    id: 'node-google',
    x: 400, y: 50,
    data: {
      label: 'GOOGLE AI STUDIO',
      description: '',
      ip: 'generativelanguage.googleapis.com',
      status: 'needs_activation'
    }
  },
  {
    id: 'node-frugallm',
    x: 400, y: 250,
    data: { 
      label: 'FRUGALLM CORE',
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
      label: 'OPENCODE',
      description: 'Your AI pair programmer, living right inside your IDE! OpenCode connects directly to the hub to give you brilliant, context-aware coding suggestions as you type.',
      ip: '127.0.0.1', 
      port: '3000',
      status: 'inactive'
    }
  },
  {
    id: 'node-hermes',
    x: 650, y: 500,
    data: { 
      label: 'HERMES',
      description: "Say hello to Hermes, your internal AI chat interface! It's not just for chatting; Hermes can kick off complex, multi-step agent workflows to get real work done.",
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
  return (
    <span className="tooltip-container" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', color: '#9ca3af', marginLeft: '6px', cursor: 'help', position: 'relative' }}>
      {Icons.info}
      <span className="tooltip-text">{text}</span>
    </span>
  );
};

const NodeConfigPanel = ({ node, onClose, onSave, isHermesInstalled, isOpenCodeInstalled, isOllamaInstalled, detectedVram, setDetectedVram, hasActiveBackend, handleInitializeHermes, handleOpenHermes, handleUninstallHermes, handleInitializeOpenCode, handleOpenOpenCode, handleUninstallOpenCode, handleInitializeOllama, handleOpenOllama, handleUninstallOllama, handleDisconnectOpenRouter, frugalConfig, handleOpenHermesDesktop, handleOpenHermesWeb, handleOpenOpenCodeWeb, activeProcesses, handleKillProcess }: any) => {
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [ipCopied, setIpCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    ip: node.data.ip || '',
    port: node.data.port || '',
    status: node.data.status || 'active',
    schemaPath: node.data.schemaPath || '',
    cwd: node.data.cwd || '',
    bin: node.data.bin || '',
    extraArgs: node.data.extraArgs || '',
    prompt: node.data.prompt || '',
    apiKey: '', // specifically for openrouter credentials
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
      setFormData(prev => ({
        ...prev,
        port: frugalConfig?.port?.toString() || '0',
        bind_all_interfaces: frugalConfig?.bind_all_interfaces || false,
        api_password: frugalConfig?.api_password || '',
        start_minimized: frugalConfig?.start_minimized || false
      }));
      isAutostartEnabled().then(enabled => setFormData(prev => ({ ...prev, start_on_login: enabled })));
    } else {
      setFormData({ 
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
      });
    }
  }, [node, frugalConfig]);

  const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSave = async () => {
    if (node.id === 'node-frugallm') {
      if (formData.start_on_login) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
    }
    onSave(node.id, formData);
  };
  
  const handlePanelClick = (e: any) => e.stopPropagation();

  return (
    <div onClick={handlePanelClick} style={{ 
      width: '450px', 
      maxHeight: '85vh',
      border: '1px solid var(--zen-border)', backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', borderRadius: '16px',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 48px rgba(0, 0, 0, 0.1)', overflow: 'hidden',
      zIndex: 100,
      fontFamily: 'inherit'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', borderBottom: '1px solid var(--zen-border)' }}>
        <h2 style={{ margin: 0, color: 'var(--zen-text)', fontSize: '1.2rem', fontWeight: 600 }}>{node.data.label}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af' }}>✕</button>
      </div>
      
      <div style={{ padding: '20px', flexGrow: 1, backgroundColor: 'transparent', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {node.data.isAgent ? (
            <>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>SCHEMA PATH <Tooltip text="Think of this as the agent's strict instruction manual. By giving it a JSON schema, we force the AI to return data in the exact structure your application expects. No more messy text—just clean data!" /></label>
                <input type="text" name="schemaPath" value={formData.schemaPath} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>WORKING DIR (CWD) <Tooltip text="Where should the agent live while it works? This is the folder on your computer where the agent will run commands and look for files. It's basically the agent's home base." /></label>
                <input type="text" name="cwd" value={formData.cwd} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>EXECUTABLE (BIN) <Tooltip text="Which program is actually doing the heavy lifting? This tells the system what tool to launch under the hood. Usually, it's 'agy' for our Antigravity agent, but you can plug in any CLI tool!" /></label>
                <input type="text" name="bin" value={formData.bin} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>EXTRA ARGS (CSV) <Tooltip text="Want to tweak how the agent runs? You can pass secret flags here (like '--verbose' to see its inner thoughts). Just list them out, separated by commas." /></label>
                <input type="text" name="extraArgs" value={formData.extraArgs} onChange={handleChange} placeholder="--verbose, --force"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>INSTRUCTION PROMPT <Tooltip text="This is your agent's main mission. Tell it exactly what you want it to accomplish. Be as specific as possible—the better the prompt, the better the results!" /></label>
                <textarea name="prompt" value={formData.prompt} onChange={handleChange}
                  style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none', resize: 'vertical' }} />
              </div>
            </>
          ) : (
            <>
              {node.id !== 'node-openrouter' && node.id !== 'node-google' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>IP ADDRESS / HOST <Tooltip text="Where does this service live on the network? Usually, it's right here on your computer ('127.0.0.1' or 'localhost'), but it could be a cloud API halfway across the world!" /></label>
                    {node.id === 'node-frugallm' || node.id === 'node-hermes' || node.id === 'node-opencode' ? (
                      <div style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '8px', color: 'var(--zen-text)', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, cursor: 'not-allowed' }}>
                        {node.id === 'node-frugallm' ? (formData.bind_all_interfaces ? '0.0.0.0' : '127.0.0.1') : formData.ip}
                      </div>
                    ) : (
                      <input type="text" name="ip" value={formData.ip} onChange={handleChange}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                    {node.id === 'node-hermes' || node.id === 'node-opencode' || node.id === 'node-frugallm' ? (
                      <div style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '8px', color: 'var(--zen-text)', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, cursor: 'not-allowed' }}>
                        {formData.port}
                      </div>
                    ) : (
                      <input type="text" name="port" value={formData.port} onChange={handleChange}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
                    )}
                  </div>
                </>
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
                    style={{ marginBottom: '15px', width: '100%', padding: '10px', backgroundColor: ipCopied ? '#059669' : 'var(--zen-accent)', color: '#ffffff', border: '1px solid transparent', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    {ipCopied ? '✓ OK' : 'COPY IP & PORT'}
                  </button>

                  <div style={{ marginTop: '0px' }}>
                    <CloudRoutingPanel />
                  </div>
                </>
              )}
              {node.id === 'node-openrouter' && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>API KEY <Tooltip text="Your OpenRouter API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="apiKey" value={formData.apiKey || ''} onChange={handleChange} placeholder="sk-or-v1-..."
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
                </div>
              )}
              {node.id === 'node-google' && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>API KEY <Tooltip text="Your Google AI Studio API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="googleApiKey" value={formData.googleApiKey || ''} onChange={handleChange} placeholder="AIzaSy..."
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--zen-border)', borderRadius: '8px', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: 'none' }} />
                </div>
              )}
            </>
          )}
          
        </div>
        
        <p style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '32px', marginBottom: '0', lineHeight: 1.5, fontFamily: 'sans-serif', borderTop: '1px dashed #d1d5db', paddingTop: '16px' }}>
          {node.data.description}
        </p>

      {node.id === 'node-hermes' && isHermesInstalled === false && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--zen-text)', fontSize: '0.9rem' }}>HERMES AGENT MISSING</h4>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--zen-text)', margin: 0, fontWeight: 600 }}>Prerequisite: Connect Ollama or OpenRouter first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeHermes(); }}
              style={{ width: '100%', padding: '12px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', border: '2px solid #9a3412', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              INITIALIZE HERMES
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-hermes' && isHermesInstalled === true && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--zen-text)', fontSize: '0.9rem' }}>HERMES AGENT INSTALLED</h4>
          {confirmUninstall === 'hermes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallHermes(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="hermes_workspace" value={formData.hermes_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #166534', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600 }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenHermes(); }}
                style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: '#FFFFFF', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH HERMES
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenHermesDesktop(); }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                  LAUNCH DESKTOP
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenHermesWeb(); }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                  LAUNCH WEBUI
                </button>
              </div>
              {['run-hermes', 'run-hermes-desktop', 'run-hermes-web'].map(mode => activeProcesses && activeProcesses[mode] && (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zen-text)', fontWeight: 700, fontSize: '0.8rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', boxShadow: '0 0 4px #16a34a' }} />
                    {mode.replace('run-', '').toUpperCase()} ACTIVE
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleKillProcess(mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>KILL</button>
                </div>
              ))}
              <button 
                onClick={(e) => { e.stopPropagation(); invoke('edit_hermes_soul').catch(console.error); }}
                style={{ width: '100%', padding: '8px', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '8px', color: '#374151', border: '2px solid #d1d5db', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                EDIT SOUL.MD
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('hermes'); }}
                style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#ef4444', border: '2px dashed #ef4444', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                UNINSTALL HERMES
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-opencode' && isOpenCodeInstalled === false && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--zen-text)', fontSize: '0.9rem' }}>OPENCODE AGENT MISSING</h4>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--zen-text)', margin: 0, fontWeight: 600 }}>Prerequisite: Connect Ollama or OpenRouter first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeOpenCode(); }}
              style={{ width: '100%', padding: '12px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', border: '2px solid #9a3412', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              INITIALIZE OPENCODE
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-opencode' && isOpenCodeInstalled === true && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--zen-text)', fontSize: '0.9rem' }}>OPENCODE AGENT INSTALLED</h4>
          {confirmUninstall === 'opencode' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOpenCode(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="opencode_workspace" value={formData.opencode_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #166534', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600 }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCode(); }}
                style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: '#FFFFFF', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH OPENCODE
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCodeWeb(); }}
                style={{ width: '100%', padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                LAUNCH WEBUI
              </button>
              {['run-opencode', 'run-opencode-web'].map(mode => activeProcesses && activeProcesses[mode] && (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px', marginBottom: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zen-text)', fontWeight: 700, fontSize: '0.8rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', boxShadow: '0 0 4px #16a34a' }} />
                    {mode.replace('run-', '').toUpperCase()} ACTIVE
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleKillProcess(mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>KILL</button>
                </div>
              ))}
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('opencode'); }}
                style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#ef4444', border: '2px dashed #ef4444', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                UNINSTALL OPENCODE
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-ollama' && isOllamaInstalled === false && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--zen-text)', fontSize: '0.9rem' }}>OLLAMA MISSING</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>VRAM DETECTED (GB) <Tooltip text="We tried to auto-detect your Video RAM, but you can correct this if it's wrong." /></label>
            <input type="text" value={detectedVram} onChange={(e) => setDetectedVram(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '2px solid #9a3412', backgroundColor: '#ffffff', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #9a3412' }} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)', marginBottom: '6px' }}>RECOMMENDED MODEL <Tooltip text="Based on your VRAM, we'll pull this model for you!" /></label>
            <input type="text" readOnly value={Number(detectedVram) >= 32 ? 'gemma4:31b' : Number(detectedVram) >= 24 ? 'gemma4:26b' : Number(detectedVram) >= 12 ? 'gemma4:12b' : Number(detectedVram) >= 8 ? 'gemma4:e4b' : Number(detectedVram) >= 4 ? 'gemma4:e2b' : 'Unsupported (< 4GB VRAM)'}
              style={{ width: '100%', padding: '10px 12px', border: '2px solid #9a3412', backgroundColor: '#fed7aa', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, cursor: 'not-allowed' }} />
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); handleInitializeOllama(); }}
            style={{ width: '100%', padding: '12px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', border: '2px solid #9a3412', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            INITIALIZE OLLAMA
          </button>
        </div>
      )}
      
      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--zen-text)', fontSize: '0.9rem' }}>OLLAMA INSTALLED</h4>
          {confirmUninstall === 'ollama' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOllama(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOllama(); }}
                style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: '#FFFFFF', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                CHAT WITH OLLAMA
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('ollama'); }}
                style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#ef4444', border: '2px dashed #ef4444', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                UNINSTALL OLLAMA
              </button>
            </div>
          )}
        </div>
      )}
      
      {node.id === 'node-openrouter' && node.data.status === 'active' && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--zen-text)', fontSize: '0.9rem' }}>OPENROUTER CONNECTED</h4>
          {confirmUninstall === 'openrouter' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--zen-text)', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectOpenRouter(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('openrouter'); }}
                style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#ef4444', border: '2px dashed #ef4444', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}
      </div>
      
      <div style={{ padding: '20px', borderTop: '1px solid var(--zen-border)', backgroundColor: '#ffffff', display: 'flex', gap: '10px' }}>
        <button onClick={handleSave} style={{ 
          flex: 1, padding: '12px', backgroundColor: 'var(--zen-accent)', color: '#FFFFFF', 
          border: '1px solid var(--zen-border)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', 
          boxShadow: 'none', transition: 'all 0.1s'
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.opacity = '0.9'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.opacity = '1'; }}
        >
          SAVE CHANGES
        </button>
      </div>
    </div>
  );
};

const TerminalView = ({ mode, sessionId, onExit, onProcessStart, onProcessExit, frugalConfig, setIsHermesInstalled, setIsOpenCodeInstalled, setIsOllamaInstalled }: { mode: 'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama', sessionId: string, onExit: () => void, onProcessStart?: () => void, onProcessExit?: () => void, frugalConfig?: any, setIsHermesInstalled: (installed: boolean) => void, setIsOpenCodeInstalled: (installed: boolean) => void, setIsOllamaInstalled: (installed: boolean) => void }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isProvisioningModel, setIsProvisioningModel] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

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
    
    // Explicitly fit before spawning PTY so cols/rows are initialized correctly
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

    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let isMounted = true;

    const start = async () => {
      if (mode.startsWith('install')) {
        let installingText = 'Initializing installation...';
        if (mode === 'install-opencode') installingText = 'Initializing OpenCode environment...';
        if (mode === 'install-hermes') installingText = 'Initializing Hermes Agent environment...';
        if (mode === 'install-ollama') installingText = 'Initializing Ollama installation...';
        term.writeln(installingText);
        unlistenOutput = await listen<{ session_id: string, data: string }>('pty_output', (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
          }
        });
        unlistenExit = await listen<{ session_id: string, exit_code: number }>('pty_exit', (event) => {
          if (event.payload.session_id !== sessionId) return;
          term.writeln(`\r\n\x1b[32mInstallation finished with code ${event.payload.exit_code}\x1b[0m\r\n`);
          if (event.payload.exit_code === 0) {
            if (mode === 'install-opencode') {
              setIsOpenCodeInstalled(true);
              setTimeout(async () => {
                if (!isMounted) return;
                try {
                  await invoke('configure_opencode_defaults');
                  term.writeln(`\\r\\n\\x1b[32mConfiguration applied. Closing...\\x1b[0m\\r\\n`);
                  setTimeout(() => { if (isMounted) onExit(); }, 1000);
                } catch (err) {
                  term.writeln(`\\r\\n\\x1b[31mFailed to configure OpenCode: ${err}\\x1b[0m\\r\\n`);
                }
              }, 1000);
            } else if (mode !== 'install-ollama') {
              setTimeout(async () => {
                if (!isMounted) return;
                try {
                  await invoke('configure_hermes_defaults');
                  term.writeln(`\r\n\x1b[32mConfiguration applied.\x1b[0m\r\n`);
                  
                  term.writeln(`\r\n\x1b[33mTesting Hermes installation...\x1b[0m`);
                  let installed = false;
                  for (let i = 0; i < 5; i++) {
                     installed = await invoke('check_hermes_status');
                     if (installed) break;
                     await new Promise(r => setTimeout(r, 1000));
                  }
                  
                  if (installed) {
                    setIsHermesInstalled(true);
                    term.writeln(`\r\n\x1b[32mHermes installed successfully!\x1b[0m\r\n`);
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                  } else {
                    term.writeln(`\r\n\x1b[31mHermes installation check failed.\x1b[0m\r\n`);
                  }
                  setTimeout(() => { if (isMounted) onExit(); }, 3000);
                } catch (err) {
                  term.writeln(`\r\n\x1b[31mFailed to configure Hermes: ${err}\x1b[0m\r\n`);
                }
              }, 1000);
            }
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
          });
          const unlisten5 = await listen<number>('model_download_progress', (event) => {
             setDownloadPercent(event.payload);
          });
          const unlisten3 = await listen<{ success: boolean; message: string }>('model_deployment_complete', async (event) => {
            setIsProvisioningModel(false);
            if (event.payload.success) {
              setIsOllamaInstalled(true);
              term.writeln(`\r\n\x1b[32mModel Provisioned successfully.\x1b[0m\r\n`);
              term.writeln(`\r\n\x1b[33mTesting endpoint...\x1b[0m`);
              try {
                const response = await tauriFetch('http://127.0.0.1:11434/api/generate', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ model: 'frugallm-active', prompt: 'say hi', stream: false })
                });
                if (response.ok) {
                   term.writeln(`\r\n\x1b[32mEndpoint test succeeded!\x1b[0m\r\n`);
                   confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                } else {
                   term.writeln(`\r\n\x1b[31mEndpoint test failed with status ${response.status}\x1b[0m\r\n`);
                }
              } catch (e) {
                 term.writeln(`\r\n\x1b[31mEndpoint test failed: ${e}\x1b[0m\r\n`);
              }
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
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${frugalEnv} && ollama run frugallm-active`] });
        } else if (mode === 'run-hermes-web') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.hermes/bin:$PATH" && ${frugalEnv} && hermes dashboard`] });
        } else if (mode === 'run-hermes-desktop') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && export PATH="$HOME/.hermes/bin:$PATH" && ${frugalEnv} && hermes desktop`] });
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
    start();

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      invoke('kill_pty', { sessionId }).catch(console.error);
      if (unlistenOutput) unlistenOutput();
      if (unlistenExit) unlistenExit();
      term.dispose();
    };
  }, [mode]);

  return (
    <div style={{ 
      position: 'absolute', top: '10vh', left: '50%', transform: 'translateX(-50%)',
      width: '80%', maxWidth: '800px', height: '60vh',
      backgroundColor: 'var(--zen-surface)', color: 'var(--zen-text)',
      borderRadius: '16px', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.15)',
      border: '1px solid var(--zen-border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--zen-border)', backgroundColor: 'var(--zen-surface-hover)' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--zen-text)' }}>
          {mode.includes('opencode') ? 'OpenCode' : mode.includes('hermes') ? 'Hermes' : 'Ollama'}
        </h2>
        {showConfirmClose ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>This will terminate the running process. Are you sure?</span>
            <button onClick={() => {
              invoke('kill_pty', { sessionId }).catch(console.error);
              onExit();
            }} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', borderRadius: '8px' }}>Yes</button>
            <button onClick={() => setShowConfirmClose(false)} style={{ padding: '6px 12px', backgroundColor: 'transparent', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', fontWeight: 600, cursor: 'pointer', borderRadius: '8px' }}>Cancel</button>
          </div>
        ) : (
          <button 
            onClick={() => setShowConfirmClose(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        )}
      </div>

      {isProvisioningModel && (
        <div style={{ padding: '16px 24px', backgroundColor: 'var(--zen-surface-hover)', borderBottom: '1px solid var(--zen-border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ width: '100%' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--zen-text)' }}>Downloading Weights...</span>
               <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--zen-accent)' }}>{downloadPercent}%</span>
             </div>
             <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--zen-border)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ width: `${downloadPercent}%`, height: '100%', backgroundColor: 'var(--zen-accent)', transition: 'width 0.2s linear' }} />
             </div>
           </div>
        </div>
      )}

      <div style={{ flex: 1, backgroundColor: '#000000', padding: '10px', overflow: 'hidden' }}>
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default function App() {
  const { onboardingState, handleDecision, isLoaded } = useOnboarding();
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  
  const {
    pan,
    zoom,
    isDragging,
    containerSize,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasClick,
    handleWheel,
  } = useCanvasLogic(canvasRef, (_e, nodeId) => {
    setSelectedNodeId(nodeId);
  }, () => {
    setSelectedNodeId(null);
  });
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [terminalMode, setTerminalMode] = useState<'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama' | null>(null);
  const [isHermesInstalled, setIsHermesInstalled] = useState<boolean | null>(null);
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState<boolean | null>(null);
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean | null>(null);

    const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [initLogs, setInitLogs] = useState<string[]>([]);
  const [frugalConfig, setFrugalConfig] = useState<any>(null);
  const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>({});

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
        addLog(hermesStatus ? "OK: Hermes installed." : "INFO: Hermes not installed.");
      } catch(e) {}
      
      addLog("Checking OpenCode agent status...");
      try {
        const opencodeStatus = await invoke('check_opencode_status');
        setIsOpenCodeInstalled(opencodeStatus as boolean);
        addLog(opencodeStatus ? "OK: OpenCode installed." : "INFO: OpenCode not installed.");
      } catch(e) {}
      await new Promise(r => setTimeout(r, 200));

      addLog("Detecting Ollama daemon...");
      try {
        const ollamaStatus = await invoke('check_ollama_status');
        setIsOllamaInstalled(ollamaStatus as boolean);
        addLog(ollamaStatus ? "OK: Ollama detected." : "INFO: Ollama not detected.");
      } catch(e) {}
      
      addLog("Detecting system VRAM...");
      try {
        const vram = await invoke('detect_vram');
        if (vram !== null && vram !== undefined) {
          const vramGb = Math.round(Number(vram) / 1024);
          setDetectedVram(String(vramGb));
          addLog(`OK: Detected ${vramGb}GB VRAM.`);
        }
      } catch(e) {}
      await new Promise(r => setTimeout(r, 300));

      addLog("Verifying OpenRouter credentials...");
      try {
        await invoke('get_credential', { service: 'openrouter' });
        setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'active' } } : n));
        addLog("OK: OpenRouter authenticated.");
      } catch(e) {
        addLog("INFO: OpenRouter credentials missing.");
      }
      await new Promise(r => setTimeout(r, 400));

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
      alert(`This port seems taken, please select a new port or disable the service currently using ${port}. Note that changing the port here might disrupt any apps that are already connected.`);
    });
    return () => {
      unlistenConfig.then(f => f());
      unlistenError.then(f => f());
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

  const [detectedVram, setDetectedVram] = useState<string>('8'); // Default placeholder

  const [activeProxyState, setActiveProxyState] = useState<{source: string, target: string} | null>(null);
  const proxyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isHermesInstalled !== null) {
      const isRunning = activeProcesses['run-hermes'] || activeProcesses['run-hermes-desktop'] || activeProcesses['run-hermes-web'];
      const status = isRunning ? 'active' : (isHermesInstalled ? 'ready' : 'not_installed');
      setNodes(nds => nds.map(n => n.id === 'node-hermes' && n.data.status !== status ? { ...n, data: { ...n.data, status } } : n));
    }
  }, [isHermesInstalled, activeProcesses]);

  useEffect(() => {
    if (isOpenCodeInstalled !== null) {
      const isRunning = activeProcesses['run-opencode'] || activeProcesses['run-opencode-web'];
      const status = isRunning ? 'active' : (isOpenCodeInstalled ? 'ready' : 'not_installed');
      setNodes(nds => nds.map(n => n.id === 'node-opencode' && n.data.status !== status ? { ...n, data: { ...n.data, status } } : n));
    }
  }, [isOpenCodeInstalled, activeProcesses]);

  useEffect(() => {
    
    
    
    
    
    

    const setupTelemetryListener = async () => {
      let unlisten = await listen<any>('telemetry_update', (event) => {
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

    

    return () => {
      if (unlistenTelemetry) {
        unlistenTelemetry();
      }
      if (unlistenProxy) {
        unlistenProxy();
      }
      if (proxyTimeout.current) {
        clearTimeout(proxyTimeout.current);
      }
    };
  }, []);

  const handleInitializeHermes = () => setTerminalMode('install-hermes');
  const handleOpenHermes = () => setTerminalMode('run-hermes');
  const handleOpenHermesDesktop = () => setTerminalMode('run-hermes-desktop');
  const handleOpenHermesWeb = () => setTerminalMode('run-hermes-web');
  const handleInitializeOpenCode = () => setTerminalMode('install-opencode');
  const handleOpenOpenCode = () => setTerminalMode('run-opencode');
  const handleOpenOpenCodeWeb = () => setTerminalMode('run-opencode-web');
  const handleInitializeOllama = () => setTerminalMode('install-ollama');
  const handleOpenOllama = () => setTerminalMode('run-ollama');

  const handleUninstallHermes = async () => {
    await invoke('spawn_pty', { command: 'bash', args: ['-c', 'rm -rf ~/.hermes'] });
    setIsHermesInstalled(false);
  };
  const handleUninstallOpenCode = async () => {
    await invoke('spawn_pty', { command: 'bash', args: ['-c', 'rm -rf ~/.opencode && rm -rf ~/.config/opencode'] });
    setIsOpenCodeInstalled(false);
  };
  const handleUninstallOllama = async () => {
    await invoke('spawn_pty', { command: 'bash', args: ['-c', 'rm -rf /usr/local/bin/ollama ~/.ollama /Applications/Ollama.app'] });
    setIsOllamaInstalled(false);
  };
  const handleDisconnectOpenRouter = async () => {
    await invoke('wipe_credentials');
    setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'inactive', apiKey: '' } } : n));
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
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#3b82f6', '#ffffff', '#111827']
            });
          } else {
             console.error("Google API key test failed", res.status);
             finalConfig.status = 'error';
          }
        } catch (e) {
          console.error("Failed to save google credential", e);
          finalConfig.status = 'error';
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
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#ea580c', '#ffffff', '#111827']
            });
          } else {
            console.error("OpenRouter API key test failed", res.status);
            finalConfig.status = 'error';
          }
        } catch (e) {
          console.error("Failed to save openrouter credential", e);
          finalConfig.status = 'error';
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
  const hasActiveBackend = nodes.some(n => (n.id === 'node-ollama' || n.id === 'node-openrouter') && n.data.status === 'active');

  if (!isLoaded) return null;

  return !isAppLoaded ? <TerminalLoader logs={initLogs} /> : (
    <div 
      style={{ display: 'flex', width: '100%', height: '100vh', fontFamily: 'inherit', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '8px', overflow: 'hidden' }}
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
          .tooltip-text {
            visibility: hidden;
            width: 200px;
            background-color: #111827;
            color: #fff;
            text-align: center;
            border-radius: 4px;
            padding: 8px;
            position: absolute;
            z-index: 1000;
            bottom: 150%;
            left: 50%;
            margin-left: -100px;
            opacity: 0;
            transition: opacity 0.2s;
            font-size: 0.75rem;
            font-family: 'sans-serif';
            font-weight: normal;
            pointer-events: none;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            text-transform: none;
          }
          .tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #111827 transparent transparent transparent;
          }
          .tooltip-container:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
          }
        `}
      </style>

      {/* Canvas Area */}
      {(['install-hermes', 'run-hermes', 'run-hermes-web', 'run-hermes-desktop', 'install-opencode', 'run-opencode', 'run-opencode-web', 'install-ollama', 'run-ollama'] as const).map((mode) => {
        const isActive = activeProcesses[mode] || terminalMode === mode;
        if (!isActive) return null;
        return (
          <div key={mode} style={{ display: terminalMode === mode ? 'flex' : 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 50, backgroundColor: 'var(--zen-accent)' }}>
            <TerminalView
               mode={mode}
               sessionId={mode}
               onExit={() => {
                 setTerminalMode(null);
                 invoke('check_hermes_status').then((installed) => setIsHermesInstalled(installed as boolean));
                 invoke('check_opencode_status').then((installed) => setIsOpenCodeInstalled(installed as boolean));
                 invoke('check_ollama_status').then((installed) => setIsOllamaInstalled(installed as boolean));
               }}
               onProcessStart={() => setActiveProcesses(prev => ({ ...prev, [mode]: true }))}
               onProcessExit={() => setActiveProcesses(prev => ({ ...prev, [mode]: false }))}
               frugalConfig={frugalConfig}
               setIsHermesInstalled={setIsHermesInstalled}
               setIsOpenCodeInstalled={setIsOpenCodeInstalled}
               setIsOllamaInstalled={setIsOllamaInstalled}
            />
          </div>
        );
      })}

        <div 
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          style={{ 
            flexGrow: 1, position: 'relative', 
            cursor: isDragging ? 'grabbing' : 'grab',
            display: terminalMode ? 'none' : 'block'
          }}
        >


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
                border: 'var(--zen-border)',
                headerBg: 'var(--zen-surface-hover)', 
                headerText: 'var(--zen-text)',
                bodyBg: 'var(--zen-surface)',
                dot: 'var(--zen-success)',
                statusText: 'var(--zen-text-secondary)',
                boxShadow: 'var(--tw-shadow-glass)',
                borderStyle: 'solid',
                borderWidth: '1px'
              };

              let Icon = Icons.cpu;
              if (node.id.includes('openrouter')) Icon = Icons.cloud;
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
                    style={{ 
                      position: 'absolute', left: node.x, top: node.y, width: NODE_WIDTH, 
                      zIndex: 1, backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '16px', boxShadow: 'var(--tw-shadow-glass)',
                      fontFamily: 'inherit'
                    }}
                    onMouseDown={(e) => handleCanvasMouseDown(e)}
                    onClick={(e) => handleNodeClick(e, node.id)}
                  >
                    <HardwareNode isGenerating={isOllamaGenerating} />
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.5px' }}>
                      {Icon}
                      {node.data.label}
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
                        <StatusLight status="active" text="HUB ONLINE" />
                        <CopyableField label="ENDPOINT" value={`${frugalConfig?.bind_all_interfaces ? '0.0.0.0' : '127.0.0.1'}:${frugalConfig?.port || '8080'}`} />
                      </>
                    ) : node.data.isAgent ? (
                      <>
                        <StatusLight status={node.data.status as any} />
                        <CopyableField label="BINARY" value={node.data.bin || 'N/A'} />
                      </>
                    ) : (
                      <>
                        <StatusLight status={node.data.status as any} text={node.data.status === 'active' ? 'Connected' : node.data.status === 'ready' ? (node.id === 'node-ollama' && isOllamaInstalled ? 'Stopped' : 'Ready') : (node.data.status.replace('_', ' ').toUpperCase())} />
                        {(node.id === 'node-hermes' || node.id === 'node-opencode') ? (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (node.id === 'node-hermes') handleOpenHermes(); 
                              else handleOpenOpenCode(); 
                            }} 
                            style={{ 
                              padding: '4px 10px', 
                              backgroundColor: 'transparent', 
                              color: '#4b5563', 
                              border: '1.5px solid #d1d5db', 
                              borderRadius: '4px',
                              fontSize: '0.7rem', 
                              fontWeight: 700, 
                              cursor: 'pointer', 
                              fontFamily: 'inherit', 
                              width: '100%', 
                              textAlign: 'center',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                              e.currentTarget.style.color = '#111827';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#4b5563';
                            }}
                          >
                            LAUNCH APP
                          </button>
                        ) : (
                          <InfoField label={(node.id.includes('openrouter') || node.id.includes('google')) ? 'HOST' : 'ENDPOINT'} value={node.data.port ? `${node.data.ip}:${node.data.port}` : `${node.data.ip}`} />
                        )}
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
          <NodeConfigPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} onSave={handleSaveNodeConfig} onOpenGuide={setActiveGuide} isHermesInstalled={isHermesInstalled} isOpenCodeInstalled={isOpenCodeInstalled} isOllamaInstalled={isOllamaInstalled} detectedVram={detectedVram} setDetectedVram={setDetectedVram} hasActiveBackend={hasActiveBackend} handleInitializeHermes={handleInitializeHermes} handleOpenHermes={handleOpenHermes} handleUninstallHermes={handleUninstallHermes} handleInitializeOpenCode={handleInitializeOpenCode} handleOpenOpenCode={handleOpenOpenCode} handleUninstallOpenCode={handleUninstallOpenCode} handleInitializeOllama={handleInitializeOllama} handleOpenOllama={handleOpenOllama} handleUninstallOllama={handleUninstallOllama} handleDisconnectOpenRouter={handleDisconnectOpenRouter} frugalConfig={frugalConfig} handleOpenHermesDesktop={handleOpenHermesDesktop} handleOpenHermesWeb={handleOpenHermesWeb} handleOpenOpenCodeWeb={handleOpenOpenCodeWeb} activeProcesses={activeProcesses} handleKillProcess={(mode: string) => invoke('kill_pty', { sessionId: mode }).catch(console.error)} />
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
