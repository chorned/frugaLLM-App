import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';
import { NodeConfigPanel } from '../pages/NodeConfigPanel';
import { TerminalRunner } from '../pages/TerminalRunner';

test.describe('Terminal Runner View', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.addInitScript(() => {
      window['invokedCommands'] = [];
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          transformCallback: () => 1234,
          invoke: (cmd: string, args: any) => {
            window['invokedCommands'].push({ cmd, args });
            console.log('IPC Mock Intercepted:', cmd, args);
            if (cmd === 'check_ollama_status') return Promise.resolve(false);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            
            if (cmd === 'spawn_pty') return Promise.resolve();
            if (cmd === 'resize_pty') return Promise.resolve();
            if (cmd === 'kill_pty') return Promise.resolve();
            if (cmd === 'write_pty') return Promise.resolve();
            if (cmd === 'plugin:event|listen') return Promise.resolve(1234);
            if (cmd === 'plugin:event|unlisten') return Promise.resolve();

            return Promise.resolve();
          }
        }
      });
    });
  });

  test('should trigger installation flow, resize, and teardown PTY on exit', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const terminal = new TerminalRunner(page);

    await canvas.goto();

    // Click Hermes to open config
    await canvas.clickNode('HERMES');
    
    // Click "INITIALIZE HERMES"
    const initButton = page.getByRole('button', { name: 'INITIALIZE HERMES' });
    await expect(initButton).toBeVisible();
    await initButton.click();

    // Terminal view should appear
    await expect(terminal.xterm).toBeVisible();

    // Wait briefly and dump commands
    await page.waitForTimeout(1000);
    const cmds = await page.evaluate(() => window['invokedCommands']);
    console.log('Invoked Commands:', cmds);

    // Verify spawn_pty and resize_pty were invoked
    await expect(async () => {
      const currentCmds = await page.evaluate(() => window['invokedCommands']);
      const spawnCall = currentCmds.find((c: any) => c.cmd === 'spawn_pty');
      expect(spawnCall).toBeDefined();
    }).toPass({ timeout: 2000 });
    
    // Wait for resize_pty
    await expect(async () => {
      const allCmds = await page.evaluate(() => window['invokedCommands']);
      const resizeCall = allCmds.find((c: any) => c.cmd === 'resize_pty');
      expect(resizeCall).toBeDefined();
    }).toPass({ timeout: 2000 });

    // Click close
    await terminal.closeButton.click();

    // Confirm close should appear
    await expect(terminal.confirmCloseText).toBeVisible();
    await terminal.yesButton.click();

    // Terminal should be closed
    await expect(terminal.xterm).not.toBeVisible();

    // Verify kill_pty was called
    const finalCmds = await page.evaluate(() => window['invokedCommands']);
    const killCall = finalCmds.find((c: any) => c.cmd === 'kill_pty');
    expect(killCall).toBeDefined();
  });
});
