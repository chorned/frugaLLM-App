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
        args: [
          '--remote-debugging-port=0',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--remote-allow-origins=*',
        ],
      },
      ...(isWin
        ? {
            'ms:edgeOptions': {
              args: [
                '--remote-debugging-port=0',
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--remote-allow-origins=*',
              ],
            },
          }
        : {}),
    },
  ],
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  logLevel: 'info',
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  beforeSession: async () => {
    if (isWin) {
      try {
        const { download } = await import('edgedriver');
        const driverPath = await download();
        console.log('[Smoke Test] Downloaded msedgedriver to:', driverPath);
        if (driverPath) {
          const driverDir = path.dirname(driverPath);
          process.env.PATH = `${driverDir}${path.delimiter}${process.env.PATH}`;
          const cargoBin = path.resolve(os.homedir(), '.cargo/bin');
          if (fs.existsSync(cargoBin)) {
            try {
              fs.copyFileSync(driverPath, path.resolve(cargoBin, 'msedgedriver.exe'));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn('[Smoke Test] edgedriver download notice:', err.message);
      }
    }

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
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
