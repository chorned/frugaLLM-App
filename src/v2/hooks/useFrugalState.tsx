import { useState, useEffect, useRef } from 'react';
import { useCanvasLogic } from './useCanvasLogic';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { listen } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
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
  'node-frugallm': { rx: 0, ry: 0.125 },
  'node-ollama': { rx: -0.3, ry: -0.075 },
  'node-openrouter': { rx: 0.3, ry: -0.075 },
  'node-hardware': { rx: -0.3, ry: -0.325 },
  'node-cloud': { rx: 0.3, ry: -0.325 },
  'node-opencode': { rx: -0.3, ry: 0.325 },
  'node-hermes': { rx: 0.3, ry: 0.325 }
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
    x: 100, y: 200,
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
    x: 700, y: 200,
    data: { 
      label: 'OPENROUTER',
      description: 'The ultimate gateway to the cloud! OpenRouter acts as a smart multiplexer, automatically routing your requests to the best and cheapest proprietary AI models available.',
      ip: 'api.openrouter.ai', 
      port: '443',
      status: 'needs_activation',
      isGenerating: false
    }
  },
  {
    id: 'node-hardware',
    x: 100, y: 0,
    data: {
      label: 'LOCAL HARDWARE',
      description: 'GPU and CPU resources dedicated to local inference.',
      status: 'active',
      isHardware: true
    }
  },
  {
    id: 'node-cloud',
    x: 700, y: 0,
    data: {
      label: 'EXTERNAL CLOUD',
      description: 'Routing to external API providers.',
      status: 'active',
      isCloud: true
    }
  },
  {
    id: 'node-frugallm',
    x: 400, y: 350,
    data: { 
      label: 'FRUGALLM CORE',
      description: 'The true mastermind of the operation. FrugalLM acts as your central hub, intercepting prompts and dynamically routing them to save you serious money without sacrificing quality!',
      ip: '127.0.0.1', 
      port: '8080',
      status: 'active'
    }
  },
  {
    id: 'node-opencode',
    x: 100, y: 500,
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
    x: 700, y: 500,
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
  { id: 'edge-ollama-hardware', source: 'node-ollama', target: 'node-hardware' },
  { id: 'edge-openrouter-cloud', source: 'node-openrouter', target: 'node-cloud' },
  { id: 'edge-frugallm-ollama', source: 'node-frugallm', target: 'node-ollama' },
  { id: 'edge-frugallm-openrouter', source: 'node-frugallm', target: 'node-openrouter' },
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

const NodeConfigPanel = ({ node, onClose, onSave, onOpenGuide, isHermesInstalled, isOpenCodeInstalled, isOllamaInstalled, detectedVram, setDetectedVram, hasActiveBackend, handleInitializeHermes, handleOpenHermes, handleUninstallHermes, handleInitializeOpenCode, handleOpenOpenCode, handleUninstallOpenCode, handleInitializeOllama, handleOpenOllama, handleUninstallOllama, handleDisconnectOpenRouter, frugalConfig, handleOpenHermesDesktop, handleOpenHermesWeb, handleOpenOpenCodeWeb, activeProcesses, handleKillProcess }: any) => {
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [ipCopied, setIpCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [confirmPasswordAction, setConfirmPasswordAction] = useState<'overwrite' | 'remove' | null>(null);
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
    bind_all_interfaces: false,
    api_password: '',
    hermes_workspace: frugalConfig?.hermes_workspace || '',
    opencode_workspace: frugalConfig?.opencode_workspace || ''
  });

  useEffect(() => {
    if (node.id === 'node-frugallm') {
      setFormData(prev => ({
        ...prev,
        port: frugalConfig?.port?.toString() || '0',
        bind_all_interfaces: frugalConfig?.bind_all_interfaces || false,
        api_password: frugalConfig?.api_password || ''
      }));
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
        bind_all_interfaces: false,
        api_password: '',
        hermes_workspace: frugalConfig?.hermes_workspace || '~/Hermes',
        opencode_workspace: frugalConfig?.opencode_workspace || '~/Opencode',
      });
    }
  }, [node, frugalConfig]);

  const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSave = () => onSave(node.id, formData);
  
  const handlePanelClick = (e: any) => e.stopPropagation();

  return (
    <div onClick={handlePanelClick} style={{ 
      width: '450px', 
      maxHeight: '85vh',
      border: '4px solid #111827', 
      backgroundColor: '#ffffff',
      display: 'flex', flexDirection: 'column',
      boxShadow: '8px 8px 0px #111827',
      zIndex: 100,
      fontFamily: '"Courier New", Courier, monospace'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#111827', color: 'white' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px' }}>{node.data.label}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9ca3af' }}>✕</button>
      </div>
      
      <div style={{ padding: '20px', flexGrow: 1, backgroundColor: '#f9fafb', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {node.data.isAgent ? (
            <>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>SCHEMA PATH <Tooltip text="Think of this as the agent's strict instruction manual. By giving it a JSON schema, we force the AI to return data in the exact structure your application expects. No more messy text—just clean data!" /></label>
                <input type="text" name="schemaPath" value={formData.schemaPath} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>WORKING DIR (CWD) <Tooltip text="Where should the agent live while it works? This is the folder on your computer where the agent will run commands and look for files. It's basically the agent's home base." /></label>
                <input type="text" name="cwd" value={formData.cwd} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>EXECUTABLE (BIN) <Tooltip text="Which program is actually doing the heavy lifting? This tells the system what tool to launch under the hood. Usually, it's 'agy' for our Antigravity agent, but you can plug in any CLI tool!" /></label>
                <input type="text" name="bin" value={formData.bin} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>EXTRA ARGS (CSV) <Tooltip text="Want to tweak how the agent runs? You can pass secret flags here (like '--verbose' to see its inner thoughts). Just list them out, separated by commas." /></label>
                <input type="text" name="extraArgs" value={formData.extraArgs} onChange={handleChange} placeholder="--verbose, --force"
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>INSTRUCTION PROMPT <Tooltip text="This is your agent's main mission. Tell it exactly what you want it to accomplish. Be as specific as possible—the better the prompt, the better the results!" /></label>
                <textarea name="prompt" value={formData.prompt} onChange={handleChange}
                  style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827', resize: 'vertical' }} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>IP ADDRESS / HOST <Tooltip text="Where does this service live on the network? Usually, it's right here on your computer ('127.0.0.1' or 'localhost'), but it could be a cloud API halfway across the world!" /></label>
                {node.id === 'node-frugallm' ? (
                  <div style={{ width: '100%', padding: '10px 12px', border: '2px dashed #9ca3af', backgroundColor: '#f3f4f6', color: '#111827', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, cursor: 'not-allowed' }}>
                    {formData.bind_all_interfaces ? '0.0.0.0' : '127.0.0.1'}
                  </div>
                ) : (
                  <input type="text" name="ip" value={formData.ip} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
                )}
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                <input type="text" name="port" value={formData.port} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
              </div>
              {node.id === 'node-frugallm' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    <input type="checkbox" id="bind_all_interfaces" name="bind_all_interfaces" checked={formData.bind_all_interfaces} onChange={e => setFormData(p => ({...p, bind_all_interfaces: e.target.checked}))} />
                    <label htmlFor="bind_all_interfaces" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827' }}>Make available everywhere <Tooltip text="Making FrugaLLM available everywhere means it will detect traffic from all your network connections. Do not enable this if you only using FrugaLLM on one machine." /></label>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>API PASSWORD (OPTIONAL) <Tooltip text="Set an API token to secure your FrugalLM node." /></label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input type="password" name="api_password" value={formData.api_password} onChange={handleChange} placeholder={frugalConfig?.api_password ? "••••••••" : "Super secret..."}
                        style={{ flexGrow: 1, padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
                      
                      {frugalConfig?.api_password && (
                        <button 
                          onClick={async () => {
                             try {
                               await navigator.clipboard.writeText(frugalConfig.api_password);
                               setPasswordCopied(true);
                               setTimeout(() => setPasswordCopied(false), 1500);
                             } catch (err) {
                               console.error('Clipboard write failed:', err);
                             }
                          }}
                          style={{ padding: '0 12px', backgroundColor: passwordCopied ? '#065f46' : '#e5e7eb', color: passwordCopied ? '#34d399' : '#111827', border: '2px solid #111827', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '2px 2px 0px #111827', transition: 'all 0.15s' }}>
                          {passwordCopied ? '✓' : 'COPY'}
                        </button>
                      )}
                    </div>
                    {confirmPasswordAction ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', backgroundColor: '#fff7ed', border: '2px dashed #ea580c' }}>
                        <span style={{ fontSize: '0.8rem', color: '#9a3412', fontWeight: 700 }}>
                          {confirmPasswordAction === 'overwrite' ? 'OVERWRITE EXISTING PASSWORD?' : 'REMOVE PASSWORD?'}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => {
                            if (confirmPasswordAction === 'remove') {
                              setFormData(prev => ({ ...prev, api_password: '' }));
                              onSave(node.id, { ...formData, api_password: '' });
                            } else {
                              onSave(node.id, formData);
                            }
                            setConfirmPasswordAction(null);
                          }} style={{ flex: 1, padding: '6px', backgroundColor: '#ef4444', color: 'white', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                          <button onClick={() => setConfirmPasswordAction(null)} style={{ flex: 1, padding: '6px', backgroundColor: '#ffffff', color: '#111827', border: '2px solid #111827', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => {
                          if (frugalConfig?.api_password && formData.api_password !== frugalConfig.api_password && formData.api_password !== '') {
                            setConfirmPasswordAction('overwrite');
                          } else if (formData.api_password !== '') {
                            onSave(node.id, formData);
                          }
                        }} style={{ flex: 1, padding: '8px', backgroundColor: '#111827', color: 'white', border: '2px solid #111827', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '2px 2px 0px #111827' }}>
                          APPLY PASSWORD
                        </button>
                        {frugalConfig?.api_password && (
                          <button onClick={() => setConfirmPasswordAction('remove')} style={{ padding: '8px', backgroundColor: '#fef2f2', color: '#ef4444', border: '2px dashed #ef4444', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            REMOVE
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f3f4f6', border: '2px dashed #9ca3af', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>SESSION TOKENS</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>{(frugalConfig?.input_tokens_session || 0) + (frugalConfig?.output_tokens_session || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>LIFETIME TOKENS</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>{(frugalConfig?.input_tokens_lifetime || 0) + (frugalConfig?.output_tokens_lifetime || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>EST. LIFETIME SAVINGS <Tooltip text="Estimated savings assuming Claude 3.5 Sonnet pricing ($3.00/1M In, $15.00/1M Out)" /></span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>
                        ${((((frugalConfig?.input_tokens_lifetime || 0) / 1000000) * 3.0) + (((frugalConfig?.output_tokens_lifetime || 0) / 1000000) * 15.0)).toFixed(4)}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                       try {
                         await navigator.clipboard.writeText(`http://${formData.bind_all_interfaces ? '0.0.0.0' : '127.0.0.1'}:${formData.port}`);
                         setIpCopied(true);
                         setTimeout(() => setIpCopied(false), 1500);
                       } catch (err) {
                         console.error('Clipboard write failed:', err);
                       }
                    }}
                    style={{ marginTop: '15px', width: '100%', padding: '8px', backgroundColor: ipCopied ? '#065f46' : '#e5e7eb', color: ipCopied ? '#34d399' : '#111827', border: '2px solid #111827', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '2px 2px 0px #111827', transition: 'all 0.15s' }}>
                    {ipCopied ? '✓ OK' : 'COPY IP & PORT'}
                  </button>

                </>
              )}
              {node.id === 'node-openrouter' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>API KEY <Tooltip text="Your OpenRouter API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="apiKey" value={formData.apiKey} onChange={handleChange} placeholder="sk-or-v1-..."
                    style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
                </div>
              )}
            </>
          )}
          
        </div>
        
        <p style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '32px', marginBottom: '0', lineHeight: 1.5, fontFamily: 'sans-serif', borderTop: '1px dashed #d1d5db', paddingTop: '16px' }}>
          {node.data.description}
        </p>

      {node.id === 'node-hermes' && isHermesInstalled === false && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#fff7ed', border: '2px dashed #ea580c', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#9a3412', fontSize: '0.9rem' }}>HERMES AGENT MISSING</h4>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.8rem', color: '#9a3412', margin: 0, fontWeight: 600 }}>Prerequisite: Connect Ollama or OpenRouter first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeHermes(); }}
              style={{ width: '100%', padding: '12px', backgroundColor: '#ea580c', color: 'white', border: '2px solid #9a3412', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              INITIALIZE HERMES
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-hermes' && isHermesInstalled === true && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0fdf4', border: '2px dashed #16a34a', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#166534', fontSize: '0.9rem' }}>HERMES AGENT INSTALLED</h4>
          {confirmUninstall === 'hermes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#9a3412', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallHermes(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: 'white', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="hermes_workspace" value={formData.hermes_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #166534', backgroundColor: '#ffffff', color: '#166534', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600 }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenHermes(); }}
                style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH HERMES
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenHermesDesktop(); }}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#dbeafe', color: '#1e3a8a', border: '2px solid #3b82f6', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                  LAUNCH DESKTOP
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenHermesWeb(); }}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#dbeafe', color: '#1e3a8a', border: '2px solid #3b82f6', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                  LAUNCH WEBUI
                </button>
              </div>
              {['run-hermes', 'run-hermes-desktop', 'run-hermes-web'].map(mode => activeProcesses && activeProcesses[mode] && (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f0fdf4', border: '2px solid #16a34a', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 700, fontSize: '0.8rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', boxShadow: '0 0 4px #16a34a' }} />
                    {mode.replace('run-', '').toUpperCase()} ACTIVE
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleKillProcess(mode); }} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>KILL</button>
                </div>
              ))}
              <button 
                onClick={(e) => { e.stopPropagation(); invoke('edit_hermes_soul').catch(console.error); }}
                style={{ width: '100%', padding: '8px', backgroundColor: '#f3f4f6', color: '#374151', border: '2px solid #d1d5db', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
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
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#fff7ed', border: '2px dashed #ea580c', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#9a3412', fontSize: '0.9rem' }}>OPENCODE AGENT MISSING</h4>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.8rem', color: '#9a3412', margin: 0, fontWeight: 600 }}>Prerequisite: Connect Ollama or OpenRouter first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeOpenCode(); }}
              style={{ width: '100%', padding: '12px', backgroundColor: '#ea580c', color: 'white', border: '2px solid #9a3412', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              INITIALIZE OPENCODE
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-opencode' && isOpenCodeInstalled === true && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0fdf4', border: '2px dashed #16a34a', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#166534', fontSize: '0.9rem' }}>OPENCODE AGENT INSTALLED</h4>
          {confirmUninstall === 'opencode' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#9a3412', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOpenCode(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: 'white', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="opencode_workspace" value={formData.opencode_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #166534', backgroundColor: '#ffffff', color: '#166534', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600 }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCode(); }}
                style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH OPENCODE
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCodeWeb(); }}
                style={{ width: '100%', padding: '8px', backgroundColor: '#dcfce7', color: '#166534', border: '2px solid #16a34a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                LAUNCH WEBUI
              </button>
              {['run-opencode', 'run-opencode-web'].map(mode => activeProcesses && activeProcesses[mode] && (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f0fdf4', border: '2px solid #16a34a', marginBottom: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 700, fontSize: '0.8rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', boxShadow: '0 0 4px #16a34a' }} />
                    {mode.replace('run-', '').toUpperCase()} ACTIVE
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleKillProcess(mode); }} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>KILL</button>
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
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#fff7ed', border: '2px dashed #ea580c', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#9a3412', fontSize: '0.9rem' }}>OLLAMA MISSING</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#9a3412', marginBottom: '6px' }}>VRAM DETECTED (GB) <Tooltip text="We tried to auto-detect your Video RAM, but you can correct this if it's wrong." /></label>
            <input type="text" value={detectedVram} onChange={(e) => setDetectedVram(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '2px solid #9a3412', backgroundColor: '#ffffff', color: '#9a3412', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #9a3412' }} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#9a3412', marginBottom: '6px' }}>RECOMMENDED MODEL <Tooltip text="Based on your VRAM, we'll pull this model for you!" /></label>
            <input type="text" readOnly value={Number(detectedVram) >= 32 ? 'gemma4:31b' : Number(detectedVram) >= 24 ? 'gemma4:26b' : Number(detectedVram) >= 12 ? 'gemma4:12b' : Number(detectedVram) >= 8 ? 'gemma4:e4b' : Number(detectedVram) >= 4 ? 'gemma4:e2b' : 'Unsupported (< 4GB VRAM)'}
              style={{ width: '100%', padding: '10px 12px', border: '2px solid #9a3412', backgroundColor: '#fed7aa', color: '#9a3412', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, cursor: 'not-allowed' }} />
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); handleInitializeOllama(); }}
            style={{ width: '100%', padding: '12px', backgroundColor: '#ea580c', color: 'white', border: '2px solid #9a3412', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            INITIALIZE OLLAMA
          </button>
        </div>
      )}
      
      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0fdf4', border: '2px dashed #16a34a', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#166534', fontSize: '0.9rem' }}>OLLAMA INSTALLED</h4>
          {confirmUninstall === 'ollama' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#9a3412', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOllama(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: 'white', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: '2px solid #9ca3af', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOllama(); }}
                style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
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
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0fdf4', border: '2px dashed #16a34a', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#166534', fontSize: '0.9rem' }}>OPENROUTER CONNECTED</h4>
          {confirmUninstall === 'openrouter' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#9a3412', fontWeight: 700 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectOpenRouter(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: 'white', border: '2px solid #991b1b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
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
      
      <div style={{ padding: '20px', borderTop: '2px dashed #d1d5db', backgroundColor: '#ffffff', display: 'flex', gap: '10px' }}>
        <button onClick={handleSave} style={{ 
          flex: 1, padding: '12px', backgroundColor: '#ea580c', color: 'white', 
          border: '2px solid #111827', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '1px',
          boxShadow: '3px 3px 0px #111827', transition: 'all 0.1s'
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = '1px 1px 0px #111827'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0px #111827'; }}
        >
          UPDATE PROTOCOL
        </button>
        <button onClick={(e) => {
          e.stopPropagation();
          const guideMap: any = { 'node-ollama': 'ollama', 'node-openrouter': 'openrouter' };
          const guide = guideMap[node.id] || 'agents';
          onOpenGuide(guide);
        }} style={{ 
          padding: '12px 20px', backgroundColor: '#ffffff', color: '#111827', 
          border: '2px solid #111827', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '1px',
          boxShadow: '3px 3px 0px #111827', transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: '8px'
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = '1px 1px 0px #111827'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0px #111827'; }}
        >
          <span>HELP</span>
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>?</span>
        </button>
      </div>
    </div>
  );
};


export function useFrugalState() {
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
  } = useCanvasLogic(canvasRef, (e, nodeId) => {
    setSelectedNodeId(nodeId);
  }, () => {
    setSelectedNodeId(null);
  });
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [terminalMode, setTerminalMode] = useState<'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama' | null>(null);
  const [isHermesInstalled, setIsHermesInstalled] = useState<boolean | null>(null);
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState<boolean | null>(null);
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean | null>(null);

  const [frugalConfig, setFrugalConfig] = useState<any>(null);
  const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>({});

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
    invoke('get_frugallm_config').then((conf: any) => setFrugalConfig(conf)).catch(console.error);
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
      const status = isRunning ? 'active' : (isHermesInstalled ? 'needs_activation' : 'inactive');
      setNodes(nds => nds.map(n => n.id === 'node-hermes' && n.data.status !== status ? { ...n, data: { ...n.data, status } } : n));
    }
  }, [isHermesInstalled, activeProcesses]);

  useEffect(() => {
    if (isOpenCodeInstalled !== null) {
      const isRunning = activeProcesses['run-opencode'] || activeProcesses['run-opencode-web'];
      const status = isRunning ? 'active' : (isOpenCodeInstalled ? 'needs_activation' : 'inactive');
      setNodes(nds => nds.map(n => n.id === 'node-opencode' && n.data.status !== status ? { ...n, data: { ...n.data, status } } : n));
    }
  }, [isOpenCodeInstalled, activeProcesses]);

  useEffect(() => {
    invoke('check_hermes_status').then((installed) => {
      setIsHermesInstalled(installed as boolean);
    }).catch(console.error);
    invoke('check_opencode_status').then((installed) => {
      setIsOpenCodeInstalled(installed as boolean);
    }).catch(console.error);
    
    // Auto-detect OpenRouter
    invoke('get_credential', { service: 'openrouter' }).then(() => {
      setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'active' } } : n));
    }).catch(() => {});
    
    // Auto-detect Ollama and its installation status via backend
    invoke('check_ollama_status').then((installed) => {
      setIsOllamaInstalled(installed as boolean);
    }).catch(console.error);

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

    invoke('detect_vram').then((vram) => {
      if (vram !== null && vram !== undefined) {
        const vramGb = Math.round(Number(vram) / 1024);
        setDetectedVram(String(vramGb));
      }
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
    
    if (nodeId === 'node-openrouter') {
      if (finalConfig.apiKey) {
        try {
          await invoke('set_credential', { service: 'openrouter', secret: finalConfig.apiKey });
          finalConfig.status = 'active'; // Once key is provided, assume active. (Ideally we'd test it)
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ea580c', '#ffffff', '#111827']
          });
        } catch (e) {
          console.error("Failed to save credential", e);
          finalConfig.status = 'error';
        }
        delete finalConfig.apiKey; // Do not save the API key in the generic node data!
      }
    }
    
    if (nodeId === 'node-ollama') {
      try {
        const res = await tauriFetch(`http://${finalConfig.ip}:${finalConfig.port}/api/version`, { method: 'GET' });
        if (res.ok) {
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

  return {
    nodes, setNodes,
    selectedNodeId, setSelectedNodeId,
    guidesOpen, setGuidesOpen,
    terminalMode, setTerminalMode,
    isHermesInstalled, setIsHermesInstalled,
    isOpenCodeInstalled, setIsOpenCodeInstalled,
    isOllamaInstalled, setIsOllamaInstalled,
    frugalConfig, setFrugalConfig,
    activeProcesses, setActiveProcesses,
    detectedVram, setDetectedVram,
    activeProxyState, setActiveProxyState,
    activeGuide, setActiveGuide,
    handleInitializeHermes, handleOpenHermes, handleOpenHermesDesktop, handleOpenHermesWeb,
    handleInitializeOpenCode, handleOpenOpenCode, handleOpenOpenCodeWeb,
    handleInitializeOllama, handleOpenOllama, handleUninstallOllama,
    handleUninstallHermes, handleUninstallOpenCode,
    handleDisconnectOpenRouter,
    handleNodeClick, handleSaveNodeConfig,
    NODE_WIDTH, NODE_HEIGHT, nodeLayout,
    initialNodes, initialEdges,
    proxyTimeout,
    canvasRef, pan, zoom, isDragging, containerSize,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasClick, handleWheel,
    spreadWidth, spreadHeight, autoScale, renderedNodes
  };
}
