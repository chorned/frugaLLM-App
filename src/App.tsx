import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import confetti from 'canvas-confetti';
import { listen } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { openUrl } from '@tauri-apps/plugin-opener';
import ReactMarkdown from 'react-markdown';
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
      status: 'needs_activation'
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
  agent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"></path><path d="M19 15v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1"></path><path d="M5 22v-3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"></path></svg>
};

const Tooltip = ({ text }: { text: string }) => {
  return (
    <span className="tooltip-container" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid #9ca3af', color: '#9ca3af', fontSize: '10px', fontWeight: 'bold', marginLeft: '6px', cursor: 'help', position: 'relative' }}>
      i
      <span className="tooltip-text">{text}</span>
    </span>
  );
};

const NodeConfigPanel = ({ node, onClose, onSave, onOpenGuide, isHermesInstalled, isOpenCodeInstalled, isOllamaInstalled, detectedVram, setDetectedVram, hasActiveBackend, handleInitializeHermes, handleOpenHermes, handleInitializeOpenCode, handleOpenOpenCode, handleInitializeOllama, handleOpenOllama }: any) => {
  const [formData, setFormData] = useState({
    ip: node.data.ip || '',
    port: node.data.port || '',
    status: node.data.status || 'active',
    schemaPath: node.data.schemaPath || '',
    cwd: node.data.cwd || '',
    bin: node.data.bin || '',
    extraArgs: node.data.extraArgs || '',
    prompt: node.data.prompt || '',
    apiKey: '' // specifically for openrouter credentials
  });

  useEffect(() => {
    setFormData({ 
      ip: node.data.ip || '', 
      port: node.data.port || '', 
      status: node.data.status || 'active',
      schemaPath: node.data.schemaPath || '',
      cwd: node.data.cwd || '',
      bin: node.data.bin || '',
      extraArgs: node.data.extraArgs || '',
      prompt: node.data.prompt || '',
      apiKey: ''
    });
  }, [node]);

  const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSave = () => onSave(node.id, formData);
  
  const handlePanelClick = (e: any) => e.stopPropagation();

  return (
    <div onClick={handlePanelClick} style={{ 
      width: '320px', 
      borderLeft: '4px solid #111827', 
      backgroundColor: '#ffffff',
      display: 'flex', flexDirection: 'column',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
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
                <input type="text" name="ip" value={formData.ip} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                <input type="text" name="port" value={formData.port} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #111827', backgroundColor: '#ffffff', color: '#111827', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 600, boxShadow: '2px 2px 0px #111827' }} />
              </div>
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
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenHermes(); }}
            style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            OPEN HERMES
          </button>
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
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenOpenCode(); }}
            style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            OPEN OPENCODE
          </button>
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
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenOllama(); }}
            style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: '2px solid #166534', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            CHAT WITH OLLAMA
          </button>
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

const TerminalView = ({ mode, onExit, setIsHermesInstalled, setIsOpenCodeInstalled, setIsOllamaInstalled }: { mode: 'install-hermes' | 'run-hermes' | 'install-opencode' | 'run-opencode' | 'install-ollama' | 'run-ollama', onExit: () => void, setIsHermesInstalled: (installed: boolean) => void, setIsOpenCodeInstalled: (installed: boolean) => void, setIsOllamaInstalled: (installed: boolean) => void }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isProvisioningModel, setIsProvisioningModel] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);

  useEffect(() => {
    if (!terminalRef.current) return;
    const term = new Terminal({ theme: { background: '#111827' } });
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
      invoke('resize_pty', { cols, rows }).catch(console.error);
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
        unlistenOutput = await listen<string>('pty_output', (event) => term.write(event.payload));
        unlistenExit = await listen<{ exit_code: number }>('pty_exit', (event) => {
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
              setIsHermesInstalled(true);
              setTimeout(async () => {
                if (!isMounted) return;
                try {
                  await invoke('configure_hermes_defaults');
                  term.writeln(`\r\n\x1b[32mConfiguration applied. Closing...\x1b[0m\r\n`);
                  setTimeout(() => { if (isMounted) onExit(); }, 1000);
                } catch (err) {
                  term.writeln(`\r\n\x1b[31mFailed to configure Hermes: ${err}\x1b[0m\r\n`);
                }
              }, 1000);
            }
          }
        });
        
        if (!isMounted) return;
        if (mode === 'install-opencode') {
          await invoke('spawn_pty', { command: 'bash', args: ['-c', 'export TERM=xterm-256color && curl -fsSL https://opencode.ai/install | bash'] });
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
          await invoke('spawn_pty', { command: 'bash', args: ['-c', 'export TERM=xterm-256color && curl -sSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-setup'] });
        }
        invoke('resize_pty', { cols: term.cols, rows: term.rows }).catch(console.error);
      } else if (mode.startsWith('run')) {
        let runningText = 'Starting...';
        if (mode === 'run-opencode') runningText = 'Starting OpenCode...';
        if (mode === 'run-hermes') runningText = 'Starting Hermes Agent...';
        if (mode === 'run-ollama') runningText = 'Chatting with Ollama...';
        term.writeln(runningText);
        const dataListener = term.onData((data) => {
          invoke('write_pty', { data }).catch(console.error);
        });
        unlistenOutput = await listen<string>('pty_output', (event) => term.write(event.payload));
        unlistenExit = await listen<{ exit_code: number }>('pty_exit', (event) => {
          let name = 'Process';
          if (mode === 'run-opencode') name = 'OpenCode';
          if (mode === 'run-hermes') name = 'Hermes';
          if (mode === 'run-ollama') name = 'Ollama';
          term.writeln(`\r\n\x1b[32m${name} exited with code ${event.payload.exit_code}\x1b[0m\r\n`);
        });
        
        if (!isMounted) return;
        if (mode === 'run-opencode') {
          await invoke('spawn_pty', { command: 'bash', args: ['-c', 'export TERM=xterm-256color && export PATH="$HOME/.opencode/bin:$PATH" && opencode -m litellm/frugallm'] });
        } else if (mode === 'run-ollama') {
          await invoke('spawn_pty', { command: 'bash', args: ['-c', 'export TERM=xterm-256color && ollama run frugallm-active'] });
        } else {
          await invoke('spawn_pty', { command: 'bash', args: ['-c', 'export TERM=xterm-256color && export PATH="$HOME/.hermes/bin:$PATH" && hermes'] });
        }
        invoke('resize_pty', { cols: term.cols, rows: term.rows }).catch(console.error);
        
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
      invoke('kill_pty').catch(console.error);
      if (unlistenOutput) unlistenOutput();
      if (unlistenExit) unlistenExit();
      term.dispose();
    };
  }, [mode]);

  return (
    <div style={{ flexGrow: 1, position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: '#111827', alignItems: 'center', boxSizing: 'border-box', padding: '35px 20px 20px 20px' }}>
      <button 
        onClick={onExit}
        style={{ position: 'absolute', top: '5px', right: '15px', padding: '0', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: '20px', zIndex: 10 }}
      >
        ✕
      </button>

      {isProvisioningModel && (
        <div style={{ width: '100%', padding: '16px', backgroundColor: '#fed7aa', color: '#9a3412', border: '2px solid #9a3412', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ width: '100%' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <span style={{ fontWeight: 'bold' }}>Downloading Weights...</span>
               <span style={{ fontWeight: 'bold' }}>{downloadPercent}%</span>
             </div>
             <div style={{ width: '100%', height: '12px', backgroundColor: '#fdba74', borderRadius: '6px', overflow: 'hidden' }}>
               <div style={{ width: `${downloadPercent}%`, height: '100%', backgroundColor: '#ea580c', transition: 'width 0.2s linear' }} />
             </div>
           </div>
        </div>
      )}

      <div style={{ width: '100%', flex: 1, border: '4px solid #ea580c', backgroundColor: '#111827', display: 'flex', boxSizing: 'border-box', padding: '10px' }}>
        <div ref={terminalRef} style={{ flex: 1, overflow: 'hidden' }} />
      </div>
    </div>
  );
};

export default function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);

  // UI State
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [terminalMode, setTerminalMode] = useState<'install-hermes' | 'run-hermes' | 'install-opencode' | 'run-opencode' | 'install-ollama' | 'run-ollama' | null>(null);
  const [isHermesInstalled, setIsHermesInstalled] = useState<boolean | null>(null);
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState<boolean | null>(null);
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean | null>(null);
  const [detectedVram, setDetectedVram] = useState<string>('8'); // Default placeholder

  useEffect(() => {
    invoke('check_hermes_status').then((installed) => {
      setIsHermesInstalled(installed as boolean);
    }).catch(console.error);
    invoke('check_opencode_status').then((installed) => {
      setIsOpenCodeInstalled(installed as boolean);
    }).catch(console.error);
    invoke('check_ollama_status').then((installed) => {
      setIsOllamaInstalled(installed as boolean);
    }).catch(console.error);
    invoke('detect_vram').then((vram) => {
      if (vram !== null && vram !== undefined) {
        const vramGb = Math.round(Number(vram) / 1024);
        setDetectedVram(String(vramGb));
      }
    }).catch(console.error);
  }, []);

  const handleInitializeHermes = () => setTerminalMode('install-hermes');
  const handleOpenHermes = () => setTerminalMode('run-hermes');
  const handleInitializeOpenCode = () => setTerminalMode('install-opencode');
  const handleOpenOpenCode = () => setTerminalMode('run-opencode');
  const handleInitializeOllama = () => setTerminalMode('install-ollama');
  const handleOpenOllama = () => setTerminalMode('run-ollama');
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const handleCanvasMouseDown = (e: any) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    dragDistance.current = 0;
  };

  const handleWheel = (e: any) => {
    const zoomSensitivity = 0.002;
    const zoomDelta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(0.2, zoom + zoomDelta), 3);
    
    // Calculate mouse position relative to canvas
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Adjust pan so the zoom centers on the cursor
    const scaleRatio = newZoom / zoom;
    setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * scaleRatio,
        y: mouseY - (mouseY - prev.y) * scaleRatio
    }));
    setZoom(newZoom);
  };

  const handleCanvasMouseMove = (e: any) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    dragDistance.current += Math.abs(dx) + Math.abs(dy);

    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeClick = (e: any, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
  };

  const handleCanvasClick = () => {
    if (dragDistance.current > 5) return; // Distinguish between drag and click
    setSelectedNodeId(null);
  };

  const handleSaveNodeConfig = async (nodeId: string, newConfig: any) => {
    let finalConfig = { ...newConfig };
    
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
        const url = `http://${finalConfig.ip}:${finalConfig.port}/api/version`;
        const res = await tauriFetch(url, { method: 'GET' });
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
      } catch (err) {
        finalConfig.status = 'error';
      }
    }
    
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...finalConfig } } : n));
  };

  const renderEdge = (edge: any) => {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    if (!source || !target) return null;

    const sx = source.x + NODE_WIDTH / 2;
    const sy = source.y + NODE_HEIGHT / 2;
    const tx = target.x + NODE_WIDTH / 2;
    const ty = target.y + NODE_HEIGHT / 2;

    const isDownstream = edge.id.includes('opencode') || edge.id.includes('hermes');
    const strokeColor = '#9ca3af';

    return (
      <g key={edge.id}>
        <line 
          x1={sx} y1={sy} x2={tx} y2={ty}
          stroke={strokeColor} 
          strokeWidth="3"
          strokeDasharray="8 8"
          className={isDownstream ? "animated-flow-line-reverse" : "animated-flow-line"}
        />
        <circle cx={sx} cy={sy} r="4" fill="#111827" />
        <circle cx={tx} cy={ty} r="4" fill="#111827" />
      </g>
    );
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const hasActiveBackend = nodes.some(n => (n.id === 'node-ollama' || n.id === 'node-openrouter') && n.data.status === 'active');

  return (
    <div 
      style={{ display: 'flex', width: '100%', height: '100vh', fontFamily: '"Courier New", Courier, monospace', backgroundColor: '#f3f4f6', overflow: 'hidden' }}
    >
      <style>
        {`
          @keyframes flowAnim {
            to { stroke-dashoffset: -16; }
          }
          @keyframes flowAnimReverse {
            to { stroke-dashoffset: 16; }
          }
          .animated-flow-line {
            animation: flowAnim 1s linear infinite;
          }
          .animated-flow-line-reverse {
            animation: flowAnimReverse 1s linear infinite;
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
      {terminalMode ? (
        <TerminalView 
          mode={terminalMode} 
          onExit={() => {
            setTerminalMode(null);
            invoke('check_hermes_status').then((installed) => setIsHermesInstalled(installed as boolean));
            invoke('check_opencode_status').then((installed) => setIsOpenCodeInstalled(installed as boolean));
            invoke('check_ollama_status').then((installed) => setIsOllamaInstalled(installed as boolean));
          }}
          setIsHermesInstalled={setIsHermesInstalled}
          setIsOpenCodeInstalled={setIsOpenCodeInstalled}
          setIsOllamaInstalled={setIsOllamaInstalled}
        />
      ) : (
        <div 
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          style={{ 
            flexGrow: 1, position: 'relative', 
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <div style={{ position: 'absolute', top: 20, left: 20, backgroundColor: '#111827', padding: '12px 20px', border: '2px solid #111827', boxShadow: '4px 4px 0px rgba(0,0,0,0.5)', zIndex: 10 }}>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#ffffff', fontWeight: 900, letterSpacing: '1px' }}>TEST PROTOCOL ALPHA</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700 }}>
              NEURAL TOPOLOGY <span style={{ backgroundColor: '#374151', color: '#ffffff', padding: '2px 4px' }}>// CENTRAL HUB VIEW</span>
            </p>
          </div>

        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none'
        }}>
          {/* SVG Layer for Connections */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
            {initialEdges.map(renderEdge)}
          </svg>

          {/* Nodes Layer */}
          <div style={{ pointerEvents: 'auto' }}>
            {nodes.map(node => {
              const isSelected = selectedNodeId === node.id;
              const isCore = node.id === 'node-frugallm';
              
              let stateColors = {
                border: '#111827',
                headerBg: '#111827', 
                headerText: '#ffffff',
                bodyBg: '#ffffff',
                dot: '#0ea5e9',
                statusText: '#0ea5e9',
                boxShadow: '6px 6px 0px rgba(17, 24, 39, 1)',
                borderStyle: 'solid',
                borderWidth: '2px'
              };

              if (isCore) {
                stateColors.border = '#ea580c';
                stateColors.headerBg = '#ea580c';
                stateColors.headerText = '#ffffff';
                stateColors.dot = '#ffffff';
                stateColors.boxShadow = '6px 6px 0px rgba(234, 88, 12, 1)';
                stateColors.borderWidth = '4px';
              } else if (node.data.status === 'inactive') {
                stateColors.border = '#9ca3af';
                stateColors.headerBg = '#e5e7eb';
                stateColors.headerText = '#6b7280';
                stateColors.bodyBg = '#f3f4f6';
                stateColors.dot = '#d1d5db';
                stateColors.statusText = '#9ca3af';
                stateColors.boxShadow = 'none';
                stateColors.borderStyle = 'dashed';
                stateColors.borderWidth = '3px';
              } else if (node.data.status === 'needs_activation') {
                stateColors.border = '#111827';
                stateColors.headerBg = '#111827';
                stateColors.headerText = '#ffffff';
                stateColors.dot = '#ea580c'; 
                stateColors.statusText = '#ea580c';
              } else if (node.data.status === 'error') {
                stateColors.border = '#111827';
                stateColors.headerBg = '#111827';
                stateColors.headerText = '#ffffff';
                stateColors.dot = '#eab308'; 
                stateColors.statusText = '#eab308';
                stateColors.boxShadow = '6px 6px 0px rgba(239, 68, 68, 1)'; // Red shadow to indicate error
              }

              let Icon = Icons.cpu;
              if (node.id.includes('openrouter')) Icon = Icons.cloud;
              if (node.id === 'node-opencode') Icon = Icons.code;
              if (node.id === 'node-hermes') Icon = Icons.workflow;
              if (node.data.isAgent) Icon = Icons.agent;

              return (
                <div 
                  key={node.id}
                  className="retro-node"
                  onClick={(e) => handleNodeClick(e, node.id)}
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
                      {node.data.status === 'inactive' && (
                        <span style={{ fontSize: '0.65rem', backgroundColor: '#9ca3af', color: '#ffffff', padding: '2px 6px', borderRadius: '2px', fontWeight: 800 }}>PLANNED</span>
                      )}
                      <span style={{ 
                        display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
                        backgroundColor: stateColors.dot,
                        boxShadow: `0 0 4px ${stateColors.dot}`
                      }} />
                    </div>
                  </div>
                  
                  {/* Body */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: stateColors.bodyBg, color: '#111827' }}>
                    {isCore ? (
                       <div style={{ textAlign: 'center', padding: '4px 0' }}>
                         <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4b5563', marginBottom: '8px', borderBottom: '1px solid #d1d5db', paddingBottom: '6px' }}>
                           CENTRAL INTELLIGENCE HUB
                         </div>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setGuidesOpen(true); }}
                           style={{
                             width: '100%', padding: '8px', backgroundColor: '#ea580c', color: 'white', border: '2px solid #111827',
                             fontWeight: 700, fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer', boxShadow: '2px 2px 0px #111827'
                           }}>
                           GET STARTED
                         </button>
                       </div>
                    ) : node.data.isAgent ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #d1d5db', paddingBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#4b5563' }}>BIN:</span>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#111827' }}>{node.data.bin}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#4b5563' }}>STATUS:</span>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: stateColors.statusText }}>
                            {node.data.status.toUpperCase()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #d1d5db', paddingBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#4b5563' }}>
                            {node.id.includes('openrouter') ? 'LATENCY:' : 'PORT:'}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: node.data.status === 'inactive' ? '#9ca3af' : '#111827' }}>
                            {node.id.includes('openrouter') ? '142ms' : node.data.port}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#4b5563' }}>STATUS:</span>
                          <span style={{ fontWeight: 700, fontSize: '0.7rem', color: stateColors.statusText }}>
                            {node.data.status.toUpperCase()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
      )}
      {/* Side Panel */}
      {selectedNode && !terminalMode && (
        <NodeConfigPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} onSave={handleSaveNodeConfig} onOpenGuide={setActiveGuide} isHermesInstalled={isHermesInstalled} isOpenCodeInstalled={isOpenCodeInstalled} isOllamaInstalled={isOllamaInstalled} detectedVram={detectedVram} setDetectedVram={setDetectedVram} hasActiveBackend={hasActiveBackend} handleInitializeHermes={handleInitializeHermes} handleOpenHermes={handleOpenHermes} handleInitializeOpenCode={handleInitializeOpenCode} handleOpenOpenCode={handleOpenOpenCode} handleInitializeOllama={handleInitializeOllama} handleOpenOllama={handleOpenOllama} />
      )}

      {/* Guides Modal */}
      {guidesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setGuidesOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '500px', backgroundColor: '#ffffff', border: '4px solid #111827', boxShadow: '8px 8px 0px #111827', padding: '30px', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", Courier, monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #111827', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px' }}>FRUGALLM // QUICKSTART GUIDES</h2>
              <button onClick={() => setGuidesOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#111827', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '24px', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
              Welcome to the FrugalLLM Central Hub. Select a guide below to learn how to configure your neural topology and orchestrate your AI agents:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '16px', border: '2px solid #111827', backgroundColor: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '2px 2px 0px #111827', transition: 'transform 0.1s' }} onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = 'none'; }} onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111827'; }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: '#ea580c', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', borderRadius: '4px' }}>1</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', marginBottom: '4px' }}>Defining JSON Schemas</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'sans-serif' }}>Learn how to force agents to return strict data formats.</div>
                </div>
              </div>
              
              <div style={{ padding: '16px', border: '2px solid #111827', backgroundColor: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '2px 2px 0px #111827', transition: 'transform 0.1s' }} onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = 'none'; }} onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111827'; }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: '#ea580c', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', borderRadius: '4px' }}>2</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', marginBottom: '4px' }}>Connecting Local Ollama</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'sans-serif' }}>How to run completely private models locally on port 11434.</div>
                </div>
              </div>
              
              <div style={{ padding: '16px', border: '2px solid #111827', backgroundColor: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '2px 2px 0px #111827', transition: 'transform 0.1s' }} onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = 'none'; }} onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111827'; }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: '#ea580c', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem', borderRadius: '4px' }}>3</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', marginBottom: '4px' }}>Advanced OpenRouter Multiplexing</div>
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
          <div onClick={e => e.stopPropagation()} style={{ width: '700px', maxHeight: '80vh', backgroundColor: '#ffffff', border: '4px solid #111827', boxShadow: '8px 8px 0px #111827', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#111827', color: 'white' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px', fontFamily: '"Courier New", Courier, monospace' }}>FRUGALLM // GUIDE</h2>
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
                      <code {...props} style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em', color: '#ea580c' }}>
                        {children}
                      </code>
                    ) : (
                      <div style={{ backgroundColor: '#111827', color: '#f3f4f6', padding: '12px', borderRadius: '4px', overflowX: 'auto', marginBottom: '16px', fontFamily: 'monospace', fontSize: '0.9em' }}>
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
    </div>
  );
}
