import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';
import { NodeConfigPanel } from '../pages/NodeConfigPanel';
import { TerminalRunner } from '../pages/TerminalRunner';

test.describe('Terminal Runner View', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.addInitScript(() => {
      const win = window as Record<string, any>;
      win.localStorage.setItem("onboardingState", "completed");
      win["__TAURI_EVENT_PLUGIN_INTERNALS__"] = { unregisterListener: () => {} };
      win['invokedCommands'] = [];
      win['tauriEventCallbacks'] = {};
      win['tauriListeners'] = {};
      let nextId = 1;

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          transformCallback: (callback: any) => {
             const id = nextId++;
             win['tauriEventCallbacks'][id] = callback;
             return id;
          },
          plugins: { event: { unregisterListener: () => {} } },
          invoke: (cmd: string, args: any) => {
            win['invokedCommands'].push({ cmd, args });
            console.log('IPC Mock Intercepted:', cmd, args);
            
            if (cmd === 'plugin:event|listen') {
               const eventName = args.event;
               const handlerId = args.handler;
               if (!win['tauriListeners'][eventName]) {
                   win['tauriListeners'][eventName] = [];
               }
               win['tauriListeners'][eventName].push(win['tauriEventCallbacks'][handlerId]);
               return Promise.resolve(handlerId);
            }

            if (cmd === 'check_ollama_status') return Promise.resolve(false);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:e2b');
            
            if (cmd === 'spawn_pty') return Promise.resolve();
            if (cmd === 'resize_pty') return Promise.resolve();
            if (cmd === 'kill_pty') return Promise.resolve();
            if (cmd === 'write_pty') return Promise.resolve();
            if (cmd === 'plugin:event|unlisten') return Promise.resolve();

            return Promise.resolve();
          }
        }
      });

      win.emitTauriEvent = (event: string, payload: any) => {
         const listeners = win['tauriListeners'][event] || [];
         for (const listener of listeners) {
             listener({ event, payload });
         }
      };
    });
  });

  test('should trigger installation flow, resize, and teardown PTY on exit', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const terminal = new TerminalRunner(page);

    await canvas.goto();

    // Click Hermes to open config
    await canvas.clickNode('Hermes');
    
    // Click "INSTALL HERMES"
    const initButton = page.getByRole('button', { name: /INSTALL HERMES/i });
    await expect(initButton).toBeVisible();
    await initButton.click();

    // Terminal view should appear
    await expect(terminal.xterm).toBeVisible();

    // Wait briefly and dump commands
    await page.waitForTimeout(1000);
    const cmds = await page.evaluate(() => (window as Record<string, any>)['invokedCommands']);
    console.log('Invoked Commands:', cmds);

    // Verify spawn_pty and resize_pty were invoked
    await expect(async () => {
      const currentCmds = await page.evaluate(() => (window as Record<string, any>)['invokedCommands']);
      const spawnCall = currentCmds.find((c: any) => c.cmd === 'spawn_pty');
      expect(spawnCall).toBeDefined();
    }).toPass({ timeout: 2000 });
    
    // Wait for resize_pty
    await expect(async () => {
      const allCmds = await page.evaluate(() => (window as Record<string, any>)['invokedCommands']);
      const resizeCall = allCmds.find((c: any) => c.cmd === 'resize_pty');
      expect(resizeCall).toBeDefined();
    }).toPass({ timeout: 2000 });

    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/terminal.png', fullPage: true });
    await page.screenshot({ path: '/Users/chorned/.no-mistakes/evidence/01M1FX7FKFWT0N0GVMWC04F0QM/terminal-active.png', fullPage: true });

    // Click close
    await terminal.closeButton.click();

    // Confirm close should appear with updated copy
    await expect(terminal.confirmCloseText).toBeVisible();
    await expect(terminal.yesButton).toBeVisible();
    await expect(terminal.cancelButton).toBeVisible();

    await page.screenshot({ path: '/Users/chorned/.no-mistakes/evidence/01M1FX7FKFWT0N0GVMWC04F0QM/terminal-confirm-close.png', fullPage: true });

    // Test cancel button
    await terminal.cancelButton.click();
    await expect(terminal.confirmCloseText).not.toBeVisible();
    await expect(terminal.closeButton).toBeVisible();

    // Click close again and confirm
    await terminal.closeButton.click();
    await expect(terminal.confirmCloseText).toBeVisible();
    await terminal.yesButton.click();

    // Terminal should be closed
    await expect(terminal.xterm).not.toBeVisible();

    // Verify kill_pty was called
    const finalCmds = await page.evaluate(() => (window as Record<string, any>)['invokedCommands']);
    const killCall = finalCmds.find((c: any) => c.cmd === 'kill_pty');
    expect(killCall).toBeDefined();
  });

  test('should display download speed, ETA, and progress stats during model provisioning', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const terminal = new TerminalRunner(page);

    await canvas.goto();

    // Click Ollama node to open config
    await canvas.clickNode('Ollama');

    // Click "INSTALL OLLAMA"
    const initButton = page.getByRole('button', { name: /INSTALL OLLAMA/i });
    await expect(initButton).toBeVisible();
    await initButton.click();

    // Terminal view should appear
    await expect(terminal.xterm).toBeVisible();

    // Simulate model_provisioning_started and model_download_progress with speed and ETA payload
    await page.evaluate(() => {
      (window as any).emitTauriEvent('model_provisioning_started', {});
      (window as any).emitTauriEvent('model_download_progress', {
        percent: 45,
        completed: 4500000000,
        total: 10000000000,
        speed_bytes_per_sec: 25000000,
        eta_seconds: 220
      });
    });

    // Check that provisioning bar and progress indicators are rendered
    await expect(terminal.provisioningBar).toBeVisible();
    await expect(terminal.downloadSize).toHaveText('(4.2 GB / 9.3 GB)');
    await expect(terminal.downloadSpeed).toContainText('23.8 MB/s');
    await expect(terminal.downloadEta).toContainText('3m 40s left');
    await expect(page.getByText('45%')).toBeVisible();

    await page.screenshot({ path: '/Users/chorned/.no-mistakes/evidence/01M1FX7FKFWT0N0GVMWC04F0QM/terminal-model-provisioning.png', fullPage: true });
  });
});
