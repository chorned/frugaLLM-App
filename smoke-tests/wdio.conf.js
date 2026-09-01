import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isWin = process.platform === 'win32';
const binaryName = isWin ? 'frugallm-app.exe' : 'frugallm-app';
const binaryPath = path.resolve(__dirname, '../src-tauri/target/release', binaryName);

let tauriDriver;

export const config = {
  runner: 'local',
  hostname: '127.0.0.1',
  port: 4444,
  path: '/',
  specs: [
    path.resolve(__dirname, './binary.spec.js'),
  ],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      'wdio:enforceWebDriverClassic': true,
      'tauri:options': {
        application: binaryPath,
      },
    },
  ],
  logLevel: 'info',
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  beforeSession: async () => {
    const cargoBinDriver = path.resolve(os.homedir(), '.cargo/bin', isWin ? 'tauri-driver.exe' : 'tauri-driver');
    const driverCmd = fs.existsSync(cargoBinDriver) ? cargoBinDriver : 'tauri-driver';

    try {
      tauriDriver = spawn(driverCmd, [], {
        stdio: [null, process.stdout, process.stderr],
      });
      tauriDriver.on('error', (err) => {
        console.warn('[Smoke Test] tauri-driver spawn notice:', err.message);
      });
      // Allow tauri-driver to bind to port 4444
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (e) {
      console.warn('[Smoke Test] Could not spawn tauri-driver automatically in beforeSession:', e);
    }
  },
  afterSession: () => {
    if (tauriDriver && !tauriDriver.killed) {
      try {
        tauriDriver.kill();
      } catch (err) {
        console.error('[Smoke Test] Error stopping tauri-driver:', err);
      }
    }
  },
};
