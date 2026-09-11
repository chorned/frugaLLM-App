import React, { useRef, useState, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  setToolGatewayInstalled,
  setFrugallmConfig,
  configureOpencodeDefaults,
  configureHermesDefaults,
  spawnPty,
  deployLocalModel,
  resizePty,
  writePty,
  getOllamaChatModel,
  killPty,
} from '../services/tauri';
import { listen } from '@tauri-apps/api/event';
import confetti from 'canvas-confetti';
import { loadOnnxClassifier, clearOnnxCache } from '../services/onnxGateway';
import { getProviderIcon } from './icons/ProviderIcons';
import en from '../locales/en.json';

export function isWindowsPlatform(): boolean {
  if (typeof navigator !== 'undefined') {
    const platform = (navigator.platform || '').toLowerCase();
    const userAgent = (navigator.userAgent || '').toLowerCase();
    return platform.includes('win') || userAgent.includes('windows');
  }
  return false;
}

export interface TerminalViewProps {
  mode: 'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-gateway' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama' | 'install-tool-gateway' | 'uninstall-tool-gateway';
  sessionId: string;
  onExit: () => void;
  onProcessStart?: () => void;
  onProcessExit?: () => void;
  frugalConfig?: any;
  setFrugalConfig?: any;
  setIsHermesInstalled: (installed: boolean) => void;
  setIsOpenCodeInstalled: (installed: boolean) => void;
  setIsOllamaInstalled: (installed: boolean) => void;
  setIsToolGatewayInstalled?: (installed: boolean) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ mode, sessionId, onExit, onProcessStart, onProcessExit, frugalConfig, setFrugalConfig, setIsHermesInstalled, setIsOpenCodeInstalled, setIsOllamaInstalled, setIsToolGatewayInstalled }: { mode: 'install-hermes' | 'run-hermes' | 'run-hermes-web' | 'run-hermes-gateway' | 'run-hermes-desktop' | 'install-opencode' | 'run-opencode' | 'run-opencode-web' | 'install-ollama' | 'run-ollama' | 'install-tool-gateway' | 'uninstall-tool-gateway', sessionId: string, onExit: () => void, onProcessStart?: () => void, onProcessExit?: () => void, frugalConfig?: any, setFrugalConfig?: any, setIsHermesInstalled: (installed: boolean) => void, setIsOpenCodeInstalled: (installed: boolean) => void, setIsOllamaInstalled: (installed: boolean) => void, setIsToolGatewayInstalled?: (installed: boolean) => void }) => {
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
      resizePty(sessionId, cols, rows).catch(console.error);
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
        await killPty(sessionId);
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
          await loadOnnxClassifier((info: any) => {
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
            await setToolGatewayInstalled(true);
            if (setFrugalConfig) {
              setFrugalConfig((prev: any) => {
                const next = { ...prev, tool_enforcing_gateway: true };
                setFrugallmConfig(next).catch(console.error);
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
          await setToolGatewayInstalled(false);
          if (setFrugalConfig) {
            setFrugalConfig((prev: any) => {
              const next = { ...prev, tool_enforcing_gateway: false };
              setFrugallmConfig(next).catch(console.error);
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
        
        let hermesProgressTimer: any = null;
        if (mode === 'install-hermes') {
          term.writeln('\x1b[36mInitializing Hermes Agent environment...\x1b[0m');
          term.writeln('\x1b[90mHermes provisions uv, git repositories, and a dedicated Python venv (typically takes 2-4 minutes).\x1b[0m\r\n');
          let elapsed = 0;
          hermesProgressTimer = setInterval(() => {
            elapsed += 30;
            if (elapsed < 360) {
              term.writeln(`\r\n\x1b[33m[Hermes Provisioning] Still configuring Python virtualenv & dependencies (${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed)...\x1b[0m`);
            } else {
              term.writeln(`\r\n\x1b[33m[Hermes Provisioning] Installation taking longer than expected (${Math.floor(elapsed / 60)}m elapsed). Still awaiting completion...\x1b[0m`);
            }
          }, 30000);
        }

        unlistenOutput = await listen<{ session_id: string, data: string }>('pty_output', (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
            window.dispatchEvent(new CustomEvent('pty_bytes', { detail: event.payload.data.length }));
          }
        });
        unlistenExit = await listen<{ session_id: string, exit_code: number }>('pty_exit', async (event) => {
          if (event.payload.session_id !== sessionId) return;
          if (hermesProgressTimer) {
            clearInterval(hermesProgressTimer);
            hermesProgressTimer = null;
          }
          if (onProcessExit) onProcessExit();
          if (event.payload.exit_code === 0) {
            if (mode === 'install-opencode') {
              setIsOpenCodeInstalled(true);
              setTimeout(async () => {
                if (!isMounted) return;
                try {
                  await configureOpencodeDefaults();
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
                  await configureHermesDefaults();
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

        if (!isMounted) {
          if (hermesProgressTimer) clearInterval(hermesProgressTimer);
          return;
        }
        if (onProcessStart) onProcessStart();
        const isWindows = isWindowsPlatform();
        try {
          if (mode === 'install-opencode') {
            if (isWindows) {
              const script = `
                $ProgressPreference = 'SilentlyContinue';
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
                $binDir = Join-Path $HOME '.opencode\\bin';
                if (!(Test-Path -Path $binDir)) { New-Item -ItemType Directory -Force -Path $binDir | Out-Null };
                $localBin = Join-Path $HOME '.local\\bin';
                if (!(Test-Path -Path $localBin)) { New-Item -ItemType Directory -Force -Path $localBin | Out-Null };
                Write-Host '[Stage 1/2] Installing opencode-ai globally via npm...';
                try {
                  npm install -g opencode-ai;
                  Write-Host 'npm install complete. Verifying and shimming executables...';
                  $npmDir = Join-Path $env:APPDATA 'npm';
                  $npmExe = Join-Path $npmDir 'node_modules\\opencode-ai\\bin\\opencode.exe';
                  $npmCmd = Join-Path $npmDir 'opencode.cmd';
                  if (Test-Path -Path $npmExe) {
                    Copy-Item -Path $npmExe -Destination (Join-Path $localBin 'opencode.exe') -Force;
                    Copy-Item -Path $npmExe -Destination (Join-Path $binDir 'opencode.exe') -Force;
                  }
                  if (Test-Path -Path $npmCmd) {
                    Copy-Item -Path $npmCmd -Destination (Join-Path $localBin 'opencode.cmd') -Force;
                    Copy-Item -Path $npmCmd -Destination (Join-Path $binDir 'opencode.cmd') -Force;
                  }
                  Write-Host '[Stage 2/2] OpenCode installed successfully.';
                } catch {
                  Write-Warning ('npm install failed: ' + $_.Exception.Message + '. Attempting fallback release download...');
                  $zipPath = Join-Path $env:TEMP 'opencode-windows-x64.zip';
                  Invoke-WebRequest -Uri 'https://github.com/anomalyco/opencode/releases/latest/download/opencode-windows-x64.zip' -OutFile $zipPath -UseBasicParsing;
                  Expand-Archive -Path $zipPath -DestinationPath $binDir -Force;
                  Remove-Item -Force $zipPath -ErrorAction SilentlyContinue;
                  Write-Host '[Stage 2/2] OpenCode binary installed successfully.';
                }
              `.replace(/\n\s+/g, ' ').trim();
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script] });
            } else {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', 'export TERM=xterm-256color && curl -fsSL https://opencode.ai/install | bash'] });
            }
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
            
            deployLocalModel().catch((err) => {
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
            if (isWindows) {
              const script = `
                $ProgressPreference = 'SilentlyContinue';
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
                Write-Host '[Stage 1/3] Fetching Hermes Agent installer...';
                $s = Invoke-RestMethod -Uri 'https://hermes-agent.nousresearch.com/install.ps1';
                $b = [scriptblock]::Create($s);
                Write-Host '[Stage 2/3] Provisioning uv, repository, and Python virtual environment (2-4 min)...';
                & $b -SkipSetup -NonInteractive;
                Write-Host '[Stage 3/3] Hermes Agent installation complete.';
              `.replace(/\n\s+/g, ' ').trim();
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script] });
            } else {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', 'export TERM=xterm-256color && echo "[Stage 1/3] Fetching Hermes Agent installer..." && curl -sSL https://hermes-agent.nousresearch.com/install.sh | { echo "[Stage 2/3] Provisioning uv and Python environment (2-4 min)..."; bash -s -- --skip-setup; } && echo "[Stage 3/3] Hermes Agent installation complete."'] });
            }
          }
          resizePty(sessionId, term.cols, term.rows).catch(console.error);
        } catch (err: any) {
          if (hermesProgressTimer) {
            clearInterval(hermesProgressTimer);
            hermesProgressTimer = null;
          }
          console.error('Failed to spawn PTY process:', err);
          term.writeln(`\r\n\x1b[31mFailed to launch process: ${err?.message || err}\x1b[0m\r\n`);
          if (onProcessExit) onProcessExit();
        }
      } else if (mode.startsWith('run')) {
        let runningText = 'Starting...';
        if (mode.startsWith('run-opencode')) runningText = 'Starting OpenCode...';
        if (mode.startsWith('run-hermes')) runningText = 'Starting Hermes Agent...';
        if (mode === 'run-ollama') runningText = 'Chatting with Ollama...';
        term.writeln(runningText);
        const dataListener = term.onData((data) => {
          writePty(sessionId, data).catch(console.error);
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
        const isWindows = isWindowsPlatform();
        try {
          if (isWindows) {
            const winFrugalEnv = `$env:OPENAI_API_BASE="http://${frugalConfig?.ip || '127.0.0.1'}:${frugalConfig?.port || '61721'}/v1"; $env:OPENAI_API_KEY="${frugalConfig?.api_password || 'frugallm'}";`;
            const winPathEnv = `$env:PATH="$HOME\\.local\\bin;$HOME\\.hermes\\bin;$HOME\\.opencode\\bin;$HOME\\.cargo\\bin;$env:APPDATA\\npm;$env:LOCALAPPDATA\\hermes\\bin;$env:LOCALAPPDATA\\Programs\\opencode;$env:LOCALAPPDATA\\Programs\\Ollama;$env:PATH";`;
            const winResolveHermes = `$hermesBin = (Get-Command hermes.cmd -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1); if (!$hermesBin) { $hermesBin = (Get-Command hermes.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1) }; if (!$hermesBin) { $hermesBin = (Get-Command hermes -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1) }; if (!$hermesBin) { $candidates = @("$env:LOCALAPPDATA\\hermes\\bin\\hermes.cmd", "$HOME\\.hermes\\bin\\hermes.cmd", "$HOME\\.local\\bin\\hermes.cmd", "$env:LOCALAPPDATA\\hermes\\bin\\hermes.exe", "$HOME\\.hermes\\bin\\hermes.exe", "$HOME\\.local\\bin\\hermes.exe"); foreach ($c in $candidates) { if (Test-Path -Path $c) { $hermesBin = $c; break } } }; if (!$hermesBin) { $hermesBin = 'hermes' };`;
            const winResolveOpenCode = `$opencodeBin = (Get-Command opencode.cmd -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1); if (!$opencodeBin) { $opencodeBin = (Get-Command opencode.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1) }; if (!$opencodeBin) { $opencodeBin = (Get-Command opencode -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1) }; if (!$opencodeBin) { $candidates = @("$env:APPDATA\\npm\\opencode.cmd", "$HOME\\.local\\bin\\opencode.cmd", "$HOME\\.opencode\\bin\\opencode.cmd", "$HOME\\.local\\bin\\opencode.exe", "$HOME\\.opencode\\bin\\opencode.exe", "$env:LOCALAPPDATA\\Programs\\opencode\\opencode.exe"); foreach ($c in $candidates) { if (Test-Path -Path $c) { $opencodeBin = $c; break } } }; if (!$opencodeBin) { $opencodeBin = 'opencode' };`;

            if (mode === 'run-opencode') {
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${winPathEnv} ${winFrugalEnv} ${winResolveOpenCode} & $opencodeBin -m litellm/frugallm`] });
            } else if (mode === 'run-opencode-web') {
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${winPathEnv} ${winFrugalEnv} ${winResolveOpenCode} & $opencodeBin web`] });
            } else if (mode === 'run-ollama') {
              let targetModel = 'frugallm-active';
              try {
                const resolved = await getOllamaChatModel();
                if (resolved) targetModel = resolved;
              } catch (err) {
                console.warn('Unable to resolve dynamic ollama chat model:', err);
              }
              await spawnPty({ 
                sessionId, 
                command: 'powershell.exe', 
                args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${winPathEnv} ${winFrugalEnv} ollama run "${targetModel}"`] 
              });
            } else if (mode === 'run-hermes-web') {
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${winPathEnv} ${winFrugalEnv} ${winResolveHermes} & $hermesBin dashboard --host 127.0.0.1`] });
            } else if (mode === 'run-hermes-desktop') {
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${winPathEnv} ${winFrugalEnv} ${winResolveHermes} & $hermesBin desktop`] });
            } else if (mode === 'run-hermes-gateway') {
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${winPathEnv} ${winFrugalEnv} ${winResolveHermes} & $hermesBin gateway --host 127.0.0.1`] });
            } else {
              await spawnPty({ sessionId, command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${winPathEnv} ${winFrugalEnv} ${winResolveHermes} & $hermesBin`] });
            }
          } else {
            const frugalEnv = `export OPENAI_API_BASE="http://${frugalConfig?.ip || '127.0.0.1'}:${frugalConfig?.port || '61721'}/v1" && export OPENAI_API_KEY="${frugalConfig?.api_password || 'frugallm'}"`;
            const cliPathEnv = 'export PATH="$HOME/.local/bin:$HOME/.hermes/bin:$HOME/.opencode/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"';
            const resolveHermesBin = 'HERMES_BIN="$(command -v hermes 2>/dev/null || ([ -x "$HOME/.local/bin/hermes" ] && echo "$HOME/.local/bin/hermes") || ([ -x "$HOME/.hermes/bin/hermes" ] && echo "$HOME/.hermes/bin/hermes") || ([ -x "$HOME/.cargo/bin/hermes" ] && echo "$HOME/.cargo/bin/hermes") || echo "hermes")"';
            const resolveOpenCodeBin = 'OPENCODE_BIN="$(command -v opencode 2>/dev/null || ([ -x "$HOME/.local/bin/opencode" ] && echo "$HOME/.local/bin/opencode") || ([ -x "$HOME/.opencode/bin/opencode" ] && echo "$HOME/.opencode/bin/opencode") || ([ -x "$HOME/.cargo/bin/opencode" ] && echo "$HOME/.cargo/bin/opencode") || echo "opencode")"';
            
            if (mode === 'run-opencode') {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveOpenCodeBin} && ${frugalEnv} && "$OPENCODE_BIN" -m litellm/frugallm`] });
            } else if (mode === 'run-opencode-web') {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveOpenCodeBin} && ${frugalEnv} && "$OPENCODE_BIN" web`] });
            } else if (mode === 'run-ollama') {
              let targetModel = 'frugallm-active';
              try {
                const resolved = await getOllamaChatModel();
                if (resolved) targetModel = resolved;
              } catch (err) {
                console.warn('Unable to resolve dynamic ollama chat model:', err);
              }
              await spawnPty({ 
                sessionId, 
                command: 'bash', 
                args: ['-c', `export TERM=xterm-256color && export PATH="/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Applications/Ollama.app/Contents/Resources:$PATH" && ${frugalEnv} && TARGET_MODEL="${targetModel}" && if ! ollama list 2>/dev/null | grep -q "^$TARGET_MODEL"; then FALLBACK="$(ollama list 2>/dev/null | awk 'NR>1 {print $1}' | head -n 1)"; if [ -n "$FALLBACK" ]; then TARGET_MODEL="$FALLBACK"; fi; fi && ollama run "$TARGET_MODEL"`] 
              });
            } else if (mode === 'run-hermes-web') {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN" dashboard --host 127.0.0.1`] });
            } else if (mode === 'run-hermes-desktop') {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN" desktop`] });
            } else if (mode === 'run-hermes-gateway') {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN" gateway --host 127.0.0.1`] });
            } else {
              await spawnPty({ sessionId, command: 'bash', args: ['-c', `export TERM=xterm-256color && ${cliPathEnv} && ${resolveHermesBin} && ${frugalEnv} && "$HERMES_BIN"`] });
            }
          }
          resizePty(sessionId, term.cols, term.rows).catch(console.error);
        } catch (err: any) {
          console.error('Failed to spawn PTY process:', err);
          term.writeln(`\r\n\x1b[31mFailed to launch process: ${err?.message || err}\x1b[0m\r\n`);
          if (onProcessExit) onProcessExit();
        }
        
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
              killPty(sessionId).catch(console.error);
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

