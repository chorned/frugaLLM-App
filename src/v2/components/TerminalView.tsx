import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export const TerminalView = ({ mode, sessionId, onExit, onProcessStart, onProcessExit, frugalConfig, setIsHermesInstalled, setIsOpenCodeInstalled, setIsOllamaInstalled }: { mode: 'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama', sessionId: string, onExit: () => void, onProcessStart?: () => void, onProcessExit?: () => void, frugalConfig?: any, setIsHermesInstalled: (installed: boolean) => void, setIsOpenCodeInstalled: (installed: boolean) => void, setIsOllamaInstalled: (installed: boolean) => void }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isProvisioningModel, setIsProvisioningModel] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;
    let isMounted = true;
    const term = new Terminal({
      theme: {
        background: 'transparent',
        foreground: '#374151',
        cursor: 'var(--zen-accent)',
        selectionBackground: 'rgba(107, 127, 153, 0.3)',
      },
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      fontSize: 15, fontWeight: 500, letterSpacing: 0,
      cursorBlink: true,
      allowTransparency: true
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Slight delay to allow DOM to settle
    setTimeout(() => {
      if (isMounted) {
        try { fitAddon.fit(); } catch (e) {}
      }
    }, 50);

    const resizeObserver = new ResizeObserver(() => {
      if (isMounted) {
        try {
          fitAddon.fit();
          invoke('resize_pty', { sessionId, cols: term.cols, rows: term.rows }).catch(console.error);
        } catch (e) {}
      }
    });
    resizeObserver.observe(terminalRef.current);

    let unlistenOutput: () => void;
    let unlistenExit: () => void;

    const start = async () => {
      if (mode === 'install-hermes' || mode === 'install-opencode' || mode === 'install-ollama') {
        // installation path
        term.writeln(mode === 'install-opencode' ? `\x1b[33mDownloading and configuring OpenCode...\x1b[0m` : `\x1b[33mDownloading and configuring Hermes...\x1b[0m`);
        unlistenOutput = await listen<{ session_id: string, data: string }>('pty_output', (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
            if (event.payload.data.includes("downloading model")) {
               setIsProvisioningModel(true);
            }
            if (isProvisioningModel) {
               const match = event.payload.data.match(/(\d+)%/);
               if (match) setDownloadPercent(parseInt(match[1]));
               if (event.payload.data.includes("success")) {
                 setIsProvisioningModel(false);
               }
            }
          }
        });
        unlistenExit = await listen<{ session_id: string, exit_code: number }>('pty_exit', async (event) => {
          if (event.payload.session_id !== sessionId) return;
          term.writeln(`\r\n\x1b[32mInstallation finished with code ${event.payload.exit_code}\x1b[0m\r\n`);
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
                  
                  term.writeln(`\r\n\x1b[33mTesting Hermes installation...\x1b[0m`);
                  let installed = false;
                  for (let i = 0; i < 5; i++) {
                     installed = await invoke<boolean>('check_hermes_status');
                     if (installed) break;
                     await new Promise(r => setTimeout(r, 1000));
                  }
                  
                  if (installed) {
                    setIsHermesInstalled(true);
                    term.writeln(`\r\n\x1b[32mHermes is ready. Closing...\x1b[0m\r\n`);
                    setTimeout(() => { if (isMounted) onExit(); }, 1000);
                  } else {
                    term.writeln(`\r\n\x1b[31mHermes installation failed verification.\x1b[0m\r\n`);
                  }
                } catch (err) {
                  term.writeln(`\r\n\x1b[31mFailed to configure Hermes: ${err}\x1b[0m\r\n`);
                }
              }, 1000);
            } else {
              setIsOllamaInstalled(true);
              setTimeout(() => { if (isMounted) onExit(); }, 1000);
            }
          }
        });
        
        if (!isMounted) return;
        if (mode === 'install-opencode') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', 'curl -sSL https://raw.githubusercontent.com/frugallm/opencode/main/install.sh | bash'] });
        } else if (mode === 'install-ollama') {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'] });
        } else {
          await invoke('spawn_pty', { sessionId, command: 'bash', args: ['-c', 'curl -sSL https://raw.githubusercontent.com/frugallm/hermes/main/install.sh | bash'] });
        }
        invoke('resize_pty', { sessionId, cols: term.cols, rows: term.rows }).catch(console.error);
      } else {
        // running path
        let runningText = 'Starting OpenCode Server...';
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
      flexGrow: 1, 
      position: 'relative', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      boxSizing: 'border-box', 
      padding: '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      backdropFilter: 'blur(24px) saturate(150%)',
      width: '100%',
      height: '100%'
    }}>
      {showConfirmClose ? (
        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--zen-surface)', padding: '12px 16px', borderRadius: '12px', zIndex: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <span style={{ color: 'var(--zen-text)', fontWeight: 500, fontSize: '0.85rem' }}>Stop this process?</span>
          <button onClick={() => {
            invoke('kill_pty', { sessionId }).catch(console.error);
            onExit();
          }} style={{ padding: '6px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 500, cursor: 'pointer', borderRadius: '8px' }}>Stop</button>
          <button onClick={() => setShowConfirmClose(false)} style={{ padding: '6px 16px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: 'none', fontWeight: 500, cursor: 'pointer', borderRadius: '8px' }}>Cancel</button>
        </div>
      ) : (
        <button 
          onClick={() => setShowConfirmClose(true)}
          style={{ position: 'absolute', top: '20px', right: '20px', padding: '0', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--zen-surface)', color: 'var(--zen-text-secondary)', border: 'none', cursor: 'pointer', borderRadius: '16px', fontWeight: 'bold', fontSize: '16px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        >
          ✕
        </button>
      )}

      {isProvisioningModel && (
        <div style={{ width: '80%', maxWidth: '800px', padding: '16px', backgroundColor: 'var(--zen-surface)', color: 'var(--zen-text)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ width: '100%' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>Downloading Weights...</span>
               <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--zen-accent)' }}>{downloadPercent}%</span>
             </div>
             <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--zen-border)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ width: `${downloadPercent}%`, height: '100%', backgroundColor: 'var(--zen-accent)', transition: 'width 0.2s linear' }} />
             </div>
           </div>
        </div>
      )}

      <div style={{ 
        width: '80%', 
        maxWidth: '800px', 
        height: '60%', 
        backgroundColor: 'var(--zen-surface)', 
        borderRadius: '16px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.08), 0 0 0 1px var(--zen-border)',
        display: 'flex', 
        flexDirection: 'column',
        boxSizing: 'border-box', 
        padding: '24px',
        overflow: 'hidden'
      }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '8px', border: '2px solid var(--zen-accent)' }} />
          <span style={{ color: 'var(--zen-text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>What do you want to organize or build?</span>
        </div>
        <div ref={terminalRef} style={{ flex: 1, overflow: 'hidden' }} />
      </div>
    </div>
  );
};
