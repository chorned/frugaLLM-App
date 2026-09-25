import { test as baseTest, expect as baseExpect, Page, BrowserContext, chromium } from '@playwright/test';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isWindows, killProcessTree, killProcessesByName } from './host-process-mgr';
import { waitForPortOpen, isPortOpen, waitForPortClosed } from './port-sentinel';
import { installEmergencyHooks } from './emergency-teardown';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export interface TauriLauncherOptions {
  cleanProfile?: boolean;
  wipe?: boolean;
  port?: number;
  remoteDebuggingPort?: number;
}

export class TauriAppSession {
  private static instance: TauriAppSession | null = null;
  public child: ChildProcess | null = null;
  public page: Page | null = null;
  public context: BrowserContext | null = null;
  public proxyPort = 61721;
  public cdpPort = 9222;

  public static getInstance(): TauriAppSession {
    if (!TauriAppSession.instance) {
      TauriAppSession.instance = new TauriAppSession();
    }
    return TauriAppSession.instance;
  }

  public getBinaryPath(): string {
    const binName = isWindows ? 'frugallm-app.exe' : 'frugallm-app';
    const binaryPath = path.resolve(projectRoot, 'src-tauri', 'target', 'debug', binName);
    return binaryPath;
  }

  public async start(options: TauriLauncherOptions = {}): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    installEmergencyHooks();

    // Safeguard config port to standard 61721 so tests never inherit lingering conflict ports from aborted tests
    try {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const possibleConfigPaths = [
        path.join(home, 'Library', 'Application Support', 'com.chorned.frugallm-app', 'frugal_config.json'),
        path.join(home, 'AppData', 'Roaming', 'com.chorned.frugallm-app', 'frugal_config.json'),
        path.join(home, '.config', 'com.chorned.frugallm-app', 'frugal_config.json'),
      ];
      for (const cp of possibleConfigPaths) {
        if (fs.existsSync(cp)) {
          const raw = fs.readFileSync(cp, 'utf-8');
          const parsed = JSON.parse(raw);
          let changed = false;
          if (parsed.port && parsed.port !== 61721) {
            parsed.port = 61721;
            changed = true;
          }
          if (!parsed.installed_by_app) {
            parsed.installed_by_app = { ollama: false, hermes: true, opencode: true };
            changed = true;
          } else {
            if (!parsed.installed_by_app.hermes) {
              parsed.installed_by_app.hermes = true;
              changed = true;
            }
            if (!parsed.installed_by_app.opencode) {
              parsed.installed_by_app.opencode = true;
              changed = true;
            }
          }
          if (changed) {
            fs.writeFileSync(cp, JSON.stringify(parsed, null, 2));
          }
        }
      }
    } catch {}

    const binaryPath = this.getBinaryPath();
    if (!fs.existsSync(binaryPath)) {
      throw new Error(
        `[TauriLauncher] Native binary not found at ${binaryPath}. Ensure 'cargo tauri build --debug' has been run.`
      );
    }

    const args: string[] = ['--hidden', '--in-memory-credentials'];
    if (options.wipe) {
      args.push('--wipe');
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      FRUGALLM_IN_MEMORY_CREDENTIALS: '1',
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${this.cdpPort}`,
    };

    const isAlreadyRunning = await isPortOpen(this.proxyPort);
    if (!isAlreadyRunning) {
      console.log('🧹 [TauriLauncher] Checking for and terminating any zombie frugallm-app processes before spawn...');
      await killProcessesByName('frugallm-app');
      await waitForPortClosed(8081, 3000);
      await waitForPortClosed(8080, 3000);
      await waitForPortClosed(54321, 3000);
      await waitForPortClosed(this.proxyPort, 3000);

      console.log(`🚀 [TauriLauncher] Spawning native desktop binary: ${binaryPath} ${args.join(' ')}`);
      this.child = spawn(binaryPath, args, {
        cwd: projectRoot,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.child.stdout?.on('data', (d) => {
        const line = d.toString().trim();
        if (line) console.log(`[Native Tauri] ${line}`);
      });

      this.child.stderr?.on('data', (d) => {
        const line = d.toString().trim();
        if (line) console.error(`[Native Tauri STDERR] ${line}`);
      });

      this.child.on('exit', (code, sig) => {
        console.log(`[TauriLauncher] Native binary exited with code ${code}, signal ${sig}`);
        this.child = null;
      });

      // Wait for the native proxy server to bind and start listening
      console.log('⏳ [TauriLauncher] Waiting for FrugaLLM native proxy server...');
      const proxyOnline = await waitForPortOpen(this.proxyPort, 20000) || await waitForPortOpen(8080, 5000) || await waitForPortOpen(8081, 5000);
      if (!proxyOnline) {
        console.warn('⚠️ [TauriLauncher] Proxy port not detected within timeout, proceeding with webview connection probe...');
      } else {
        console.log('✅ [TauriLauncher] FrugaLLM native backend proxy is online.');
      }
    } else {
      console.log(`✅ [TauriLauncher] FrugaLLM native backend proxy is already online on port ${this.proxyPort}.`);
    }

    // Connect automation to the application webview
    if (isWindows) {
      console.log(`[TauriLauncher] Connecting over CDP to WebView2 on port ${this.cdpPort}...`);
      await waitForPortOpen(this.cdpPort, 15000);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${this.cdpPort}`);
      this.context = browser.contexts()[0];
      const pages = this.context.pages();
      this.page = pages[0] || await this.context.newPage();
      if (options.cleanProfile) {
        await this.page.evaluate(() => {
          localStorage.removeItem('onboardingState');
          localStorage.removeItem('onboardingStep');
          localStorage.removeItem('onboarding_footer_dismissed');
        }).catch(() => {});
        await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    } else {
      const devServerPort = 1420;
      await waitForPortOpen(devServerPort, 30000);
      const targetUrl = `http://localhost:${devServerPort}`;

      console.log(`[TauriLauncher] Attaching automation to native desktop app context at ${targetUrl}...`);
      const browser = await chromium.launch({
        headless: false,
        args: [
          `--app=${targetUrl}`,
          '--window-size=1150,750',
          '--disable-web-security',
          '--allow-running-insecure-content',
        ],
      });
      this.context = await browser.newContext({
        viewport: { width: 1150, height: 750 },
        colorScheme: 'dark',
      });

      // Inject native Tauri IPC bridge so that all frontend commands invoke the live desktop backend
      await this.context.addInitScript(({ port }) => {
        const listeners: Record<string, ((event: any) => void)[]> = {};
        const callbacks: Record<number, (data: any) => void> = {};
        let callbackIdCounter = 1;

        let currentPort = port;
        let es: EventSource | null = null;

        const connectSSE = (p: number) => {
          if (es) {
            try { es.close(); } catch {}
          }
          try {
            es = new EventSource(`http://127.0.0.1:${p}/__tauri_events__`);
            const handleEvent = (e: any) => {
              try {
                const data = JSON.parse(e.data);
                const eventName = data.event;
                let payload = data.payload;
                if (typeof payload === 'string' && (payload.startsWith('{') || payload.startsWith('['))) {
                  try {
                    payload = JSON.parse(payload);
                  } catch {}
                }
                if (listeners[eventName]) {
                  listeners[eventName].forEach((cb) => {
                    try { cb({ event: eventName, payload, id: 0 }); } catch (err) { console.error(err); }
                  });
                }
              } catch (err) {
                console.error('Failed to parse tauri event SSE message:', err);
              }
            };
            es.onmessage = handleEvent;
            es.addEventListener('tauri_event', handleEvent);
          } catch (err) {
            console.warn(`Failed to connect to SSE on port ${p}:`, err);
          }
        };

        connectSSE(currentPort);

        const origDispatchEvent = window.dispatchEvent.bind(window);
        window.dispatchEvent = (event: Event) => {
          if (event && event.type && listeners[event.type]) {
            listeners[event.type].forEach((cb) => {
              try { cb({ event: event.type, payload: (event as any).detail, id: 0 }); } catch (err) { console.error(err); }
            });
          }
          return origDispatchEvent(event);
        };

        (window as any).__PLAYWRIGHT_TEST__ = true;

        (window as any).__TAURI_INTERNALS__ = {
          transformCallback: (callback: any, once?: boolean) => {
            const id = callbackIdCounter++;
            callbacks[id] = (data: any) => {
              callback(data);
              if (once) delete callbacks[id];
            };
            return id;
          },
          invoke: async (cmd: string, args: any = {}) => {
            if (cmd === 'plugin:event|listen') {
              const eventName = args.event;
              const handlerId = args.handler;
              if (eventName && handlerId && callbacks[handlerId]) {
                if (!listeners[eventName]) listeners[eventName] = [];
                listeners[eventName].push(callbacks[handlerId]);
              }
              return 1000 + (args.handler || 1);
            }
            if (cmd === 'plugin:event|unlisten') {
              return;
            }
            if (cmd.startsWith('plugin:http|')) {
              throw new Error('plugin:http not available in mock IPC bridge');
            }

            const candidatePorts = [currentPort, 61721, 8081, 8080].filter((v, i, a) => a.indexOf(v) === i);
            let res: Response | null = null;
            let lastErr: any = null;

            for (const p of candidatePorts) {
              try {
                const controller = new AbortController();
                const timeoutMs = (cmd === 'deploy_local_model' || cmd === 'delete_local_model') ? 30000 : 2000;
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                const r = await fetch(`http://127.0.0.1:${p}/__tauri_ipc__`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cmd, args }),
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (r.ok || r.status === 500) {
                  res = r;
                  if (p !== currentPort) {
                    currentPort = p;
                    connectSSE(p);
                  }
                  break;
                }
              } catch (err) {
                lastErr = err;
              }
            }

            if (!res) {
              throw new Error(`IPC [${cmd}] network failed across ports [${candidatePorts.join(', ')}]: ${lastErr}`);
            }

            if (!res.ok) {
              const text = await res.text();
              throw new Error(`IPC [${cmd}] error (${res.status}): ${text}`);
            }
            return await res.json();
          },
          plugins: {
            event: {
              unregisterListener: () => {},
              listen: (eventName: string, handler: (event: any) => void) => {
                if (!listeners[eventName]) listeners[eventName] = [];
                listeners[eventName].push(handler);
                return Promise.resolve(1000);
              },
            },
          },
        };
      }, { port: this.proxyPort });

      this.page = await this.context.newPage();
      await this.page.goto(targetUrl);
    }

    await this.page.waitForLoadState('domcontentloaded');
    return this.page;
  }

  public async stop(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
      } catch {}
      this.context = null;
      this.page = null;
    }

    if (this.child && this.child.pid) {
      console.log(`🧹 [TauriLauncher] Terminating native app process PID ${this.child.pid}...`);
      await killProcessTree(this.child.pid);
      this.child = null;
    }

    await killProcessesByName('frugallm-app');
    await waitForPortClosed(this.proxyPort, 3000);
    await waitForPortClosed(8081, 3000);
    await waitForPortClosed(8080, 3000);
    await waitForPortClosed(54321, 3000);
  }
}

export interface TauriFixtures {
  appPage: Page;
  session: TauriAppSession;
}

/**
 * Custom Playwright fixture extending base test with `appPage` and `session`.
 */
export const test = baseTest.extend<TauriFixtures>({
  session: async ({}, use) => {
    const session = TauriAppSession.getInstance();
    await use(session);
  },
  appPage: async ({ session }, use, testInfo) => {
    const isPhase1 = testInfo.titlePath.some((p) => /\bPhase 1\b/.test(p) || p.includes('01-boot-and-onboarding'));
    const page = await session.start({ cleanProfile: isPhase1 });

    // Wait for TerminalLoader to complete initial boot sequence
    const terminalLoader = page.locator('[data-testid="terminal-loader"]');
    try {
      await terminalLoader.waitFor({ state: 'attached', timeout: 1500 });
      await terminalLoader.waitFor({ state: 'hidden', timeout: 25000 });
    } catch {
      if (await terminalLoader.isVisible().catch(() => false)) {
        await terminalLoader.waitFor({ state: 'hidden', timeout: 25000 }).catch(() => {});
      }
    }

    // If not in Phase 1 boot/onboarding spec and onboarding modal is present, advance to workspace
    if (!isPhase1) {
      const skipBtn = page.locator('[data-testid="onboarding-skip-btn"], button:has-text("Skip to Workspace")').first();
      try {
        if (await skipBtn.isVisible({ timeout: 5000 })) {
          await skipBtn.click();
          await page.waitForTimeout(400);
        }
      } catch {}
      const skipTourBtn = page.locator('[data-testid="onboarding-skip-tour-btn"], button:has-text("Skip Tour")').first();
      try {
        if (await skipTourBtn.isVisible({ timeout: 2000 })) {
          await skipTourBtn.click();
          await page.waitForTimeout(400);
        }
      } catch {}
    }
    await use(page);
  },
});

export const expect = baseExpect;
