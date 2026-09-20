import { test as baseTest, expect as baseExpect, Page, BrowserContext, chromium } from '@playwright/test';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isWindows, killProcessTree } from './host-process-mgr';
import { waitForPortOpen, isPortOpen } from './port-sentinel';
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
    const binaryPath = path.resolve(projectRoot, 'src-tauri/target/debug', binName);
    return binaryPath;
  }

  public async start(options: TauriLauncherOptions = {}): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    installEmergencyHooks();

    const binaryPath = this.getBinaryPath();
    if (!fs.existsSync(binaryPath)) {
      throw new Error(
        `[TauriLauncher] Native binary not found at ${binaryPath}. Ensure 'cargo tauri build --debug' has been run.`
      );
    }

    const args: string[] = [];
    if (options.wipe) {
      args.push('--wipe');
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${this.cdpPort}`,
    };

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
    const proxyOnline = await waitForPortOpen(this.proxyPort, 20000) || await waitForPortOpen(8080, 5000);
    if (!proxyOnline) {
      console.warn('⚠️ [TauriLauncher] Proxy port not detected within timeout, proceeding with webview connection probe...');
    } else {
      console.log('✅ [TauriLauncher] FrugaLLM native backend proxy is online.');
    }

    // Connect automation to the application webview
    if (isWindows) {
      console.log(`[TauriLauncher] Connecting over CDP to WebView2 on port ${this.cdpPort}...`);
      await waitForPortOpen(this.cdpPort, 15000);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${this.cdpPort}`);
      this.context = browser.contexts()[0];
      const pages = this.context.pages();
      this.page = pages[0] || await this.context.newPage();
    } else {
      // On macOS, launch automated browser context attached to the running desktop application
      const devServerPort = 1420;
      const isDevServerRunning = await isPortOpen(devServerPort);
      let targetUrl = `http://localhost:${devServerPort}`;

      if (!isDevServerRunning) {
        // Fallback or production static dist
        targetUrl = `http://localhost:${this.proxyPort}`;
      }

      console.log(`[TauriLauncher] Attaching automation to native desktop app context at ${targetUrl}...`);
      const browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-web-security',
          '--allow-running-insecure-content',
        ],
      });
      this.context = await browser.newContext({
        viewport: { width: 1150, height: 750 },
        colorScheme: 'dark',
      });
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
  }
}

/**
 * Custom Playwright fixture extending base test with `appPage` and `session`.
 */
export const test = baseTest.extend<{
  appPage: Page;
  session: TauriAppSession;
}>({
  session: async ({}, use) => {
    const session = TauriAppSession.getInstance();
    await use(session);
  },
  appPage: async ({ session }, use, testInfo) => {
    const page = await session.start();

    // Wait for TerminalLoader to complete initial boot sequence
    const terminalLoader = page.locator('[data-testid="terminal-loader"]');
    if (await terminalLoader.isVisible({ timeout: 1000 }).catch(() => false)) {
      await terminalLoader.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
    }

    // If not in Phase 1 boot/onboarding spec and onboarding modal is present, advance to workspace
    if (!testInfo.titlePath.some((p) => /\bPhase 1\b/.test(p) || p.includes('01-boot-and-onboarding'))) {
      const skipBtn = page.locator('[data-testid="onboarding-skip-btn"], button:has-text("Skip to Workspace")').first();
      if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(400);
      }
      const skipTourBtn = page.locator('[data-testid="onboarding-skip-tour-btn"], button:has-text("Skip Tour")').first();
      if (await skipTourBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await skipTourBtn.click();
        await page.waitForTimeout(400);
      }
    }
    await use(page);
  },
});

export const expect = baseExpect;
