#!/usr/bin/env node
import { spawnSync, spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
const isWipe = args.some(arg => arg === '--wipe' || arg.includes('--wipe'));

if (isWipe) {
  console.log('🧹 [FrugaLLM] --wipe detected: cleaning up any background dev processes and freeing port 1420...');
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    try {
      spawnSync('taskkill', ['/F', '/IM', 'frugallm-app.exe', '/T'], { stdio: 'ignore', windowsHide: true });
    } catch {}
    try {
      spawnSync('cmd.exe', ['/c', 'for /f "tokens=5" %a in (\'netstat -aon ^| findstr :1420\') do taskkill /F /PID %a >nul 2>nul'], { stdio: 'ignore', windowsHide: true });
    } catch {}
  } else {
    try {
      spawnSync('killall', ['frugallm-app'], { stdio: 'ignore' });
    } catch {}
    try {
      spawnSync('pkill', ['-9', '-f', 'target/debug/frugallm-app'], { stdio: 'ignore' });
    } catch {}
    try {
      spawnSync('sh', ['-c', 'lsof -ti :1420 | xargs kill -9 2>/dev/null || true'], { stdio: 'ignore' });
    } catch {}
  }
}

const tauriBin = resolve(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');

const child = spawn(tauriBin, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
