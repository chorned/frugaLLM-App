import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';
import { NodeConfigPanel } from '../pages/NodeConfigPanel';

test.describe('Node Configuration Panel', () => {
  let invokedCommands: any[] = [];

  test.beforeEach(async ({ page }) => {
    invokedCommands = [];
    
    // Mock Tauri IPC
    await page.addInitScript(() => {
      window.localStorage.setItem("onboardingState", "completed");
      window["__TAURI_EVENT_PLUGIN_INTERNALS__"] = { unregisterListener: () => {} };
      window['invokedCommands'] = [];
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { transformCallback: () => 1234, plugins: { event: { unregisterListener: () => {} } },
          invoke: (cmd: string, args: any) => {
            window['invokedCommands'].push({ cmd, args });
            if (cmd === 'plugin:event|listen') return Promise.resolve(1234);
            if (cmd === 'check_ollama_status') return Promise.resolve(true);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'get_frugallm_config') return Promise.resolve({});
            if (cmd === 'set_frugallm_config') return Promise.resolve();
            if (cmd === 'get_credential') return Promise.reject('No key');
            if (cmd === 'set_credential') return Promise.resolve();
            if (cmd === 'get_routing_chain') return Promise.resolve([
              { provider: 'OPENROUTER', model: 'anthropic/claude-3-opus' },
              { provider: 'OPENROUTER', model: 'anthropic/claude-3-sonnet' },
              { provider: 'GOOGLE', model: 'gemini-2.5-computer-use-preview-10-2025' }
            ]);
            if (cmd === 'refresh_routing_chain') return Promise.resolve([
              { provider: 'OPENROUTER', model: 'anthropic/claude-3-opus' },
              { provider: 'OPENROUTER', model: 'anthropic/claude-3-sonnet' },
              { provider: 'GOOGLE', model: 'gemini-2.5-computer-use-preview-10-2025' }
            ]);
            if (cmd === 'set_model_override') return Promise.resolve();
            if (cmd === 'plugin:http|fetch') return Promise.resolve(1);
            if (cmd === 'plugin:http|fetch_send') return Promise.resolve({
              status: 200,
              ok: true,
              url: 'https://mock.com',
              headers: {},
              rawHeaders: {}
            });
            if (cmd === 'plugin:http|fetch_read_body') return Promise.resolve(new ArrayBuffer(0));
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

    // Click Ollama to open config
    await canvas.clickNode('Local Hardware');
    await expect(configPanel.updateButton).toBeVisible();

    // The config for Ollama shows IP and Port
    await expect(configPanel.ip).toBeVisible();
    await expect(configPanel.port).toBeVisible();
    
    await configPanel.port.fill('11435');
    await configPanel.updateButton.click();

    // Config panel should close via close button
    await configPanel.closeButton.click();
    await expect(configPanel.updateButton).not.toBeVisible();

    // Reopen and check if saved
    await canvas.clickNode('Local Hardware');
    await expect(configPanel.port).toHaveValue('11435');
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/node-config-panel.png', fullPage: true });
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
    console.log("ALL INVOKED COMMANDS:", cmds);
    const setCredCall = cmds.find((c: any) => c.cmd === 'set_credential' && c.args?.service === 'openrouter');
    expect(setCredCall).toBeDefined();
    expect(setCredCall.args.secret).toBe('sk-or-v1-mock-key');
    
    // Verify confetti canvas was injected (confetti library creates a canvas in the body)
    await expect(page.locator('canvas').last()).toBeVisible();
  });

  test('should render FrugalLM Hub routing panel and filter computer-use models', async ({ page }) => {
    const canvas = new MainCanvas(page);
    
    await canvas.goto();

    // Click FrugalLM Hub node
    await canvas.clickNode('FRUGALLM CORE');
    
    // Check that the panel opens
    await expect(page.getByRole('heading', { name: 'FRUGALLM CORE' })).toBeVisible();

    // The COPY IP & PORT button should be visible
    await expect(page.getByRole('button', { name: /COPY IP & PORT/i })).toBeVisible();

    // The Global Routing Pool should be visible
    await expect(page.getByText('GLOBAL ROUTING POOL')).toBeVisible();

    // Check that the normal models are listed
    await expect(page.getByText('anthropic/claude-3-opus')).toBeVisible();
    await expect(page.getByText('anthropic/claude-3-sonnet')).toBeVisible();

    // The computer-use model should be filtered out
    await expect(page.getByText('gemini-2.5-computer-use-preview-10-2025')).not.toBeVisible();

    // Check that ranking buttons exist for the first model
    // Rank Down should exist for the first model
    const opusItem = page.getByTestId('model-row-anthropic/claude-3-opus');
    await expect(opusItem.getByTitle('Rank Down')).toBeVisible();

    // Click Rank Down on the first item
    await opusItem.getByTitle('Rank Down').click();
    
    // Verify Tauri IPC was called for set_model_override
    const cmds = await page.evaluate(() => window['invokedCommands']);
    const overrideCall = cmds.find((c: any) => c.cmd === 'set_model_override');
    expect(overrideCall).toBeDefined();
  });
});
