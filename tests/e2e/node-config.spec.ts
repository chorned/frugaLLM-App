import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';
import { NodeConfigPanel } from '../pages/NodeConfigPanel';

test.describe('Node Configuration Panel', () => {
  let invokedCommands: any[] = [];

  test.beforeEach(async ({ page }) => {
    invokedCommands = [];
    
    // Mock Tauri IPC
    await page.addInitScript(() => {
      window['invokedCommands'] = [];
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          invoke: (cmd: string, args: any) => {
            window['invokedCommands'].push({ cmd, args });
            if (cmd === 'check_ollama_status') return Promise.resolve(true);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'get_frugallm_config') return Promise.resolve({});
            if (cmd === 'set_frugallm_config') return Promise.resolve();
            if (cmd === 'get_credential') return Promise.reject('No key');
            if (cmd === 'set_credential') return Promise.resolve();
            return Promise.resolve();
          }
        }
      });
    });
  });

  test('should edit and save agent configurations', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click Hermes to open agent config
    await canvas.clickNode('HERMES');
    await expect(configPanel.updateButton).toBeVisible();

    // The agent config for Hermes currently shows IP and Port (since isAgent is false)
    await expect(configPanel.ip).toBeVisible();
    await expect(configPanel.port).toBeVisible();
    
    await configPanel.port.fill('3002');
    await configPanel.updateButton.click();

    // Config panel should close via close button
    await configPanel.closeButton.click();
    await expect(configPanel.updateButton).not.toBeVisible();

    // Reopen and check if saved
    await canvas.clickNode('HERMES');
    await expect(configPanel.port).toHaveValue('3002');
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/node-config-panel.png', fullPage: true });
    
    await page.getByText('HELP').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/guides.png', fullPage: true });
  });

  test('should handle network/service fields and API keys', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click OpenRouter
    await canvas.clickNode('OPENROUTER');
    await expect(configPanel.updateButton).toBeVisible();

    // Verify API Key field is password masked
    await expect(configPanel.apiKey).toHaveAttribute('type', 'password');

    // Fill API key and save
    await configPanel.apiKey.fill('sk-or-v1-mock-key');
    await configPanel.updateButton.click();

    // Verify Tauri IPC was called for set_credential
    const cmds = await page.evaluate(() => window['invokedCommands']);
    const setCredCall = cmds.find((c: any) => c.cmd === 'set_credential' && c.args?.service === 'openrouter');
    expect(setCredCall).toBeDefined();
    expect(setCredCall.args.secret).toBe('sk-or-v1-mock-key');
    
    // Verify confetti canvas was injected (confetti library creates a canvas in the body)
    await expect(page.locator('canvas').last()).toBeVisible();
  });
});
