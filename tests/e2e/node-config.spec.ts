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
      window['__MOCK_ONNX_DOWNLOAD__'] = true;
      window['invokedCommands'] = [];
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        writable: true,
        configurable: true,
        value: { transformCallback: () => 1234, plugins: { event: { unregisterListener: () => {} } },
          invoke: (cmd: string, args: any) => {
            window['invokedCommands'].push({ cmd, args });
            if (window['customInvokeHandler']) {
              const customRes = window['customInvokeHandler'](cmd, args);
              if (customRes !== undefined) return customRes;
            }
            if (cmd === 'plugin:event|listen') return Promise.resolve(1234);
            if (cmd === 'check_ollama_status') return Promise.resolve(true);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'check_tool_gateway_status') return Promise.resolve(false);
            if (cmd === 'set_tool_gateway_installed') return Promise.resolve();
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:e2b');
            if (cmd === 'get_frugallm_config') return Promise.resolve({});
            if (cmd === 'set_frugallm_config') return Promise.resolve();
            if (cmd === 'get_credential') return Promise.reject('No key');
            if (cmd === 'set_credential') return Promise.resolve();
            if (cmd === 'delete_credential') return Promise.resolve();
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
    await canvas.clickNode('Ollama');
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
    await canvas.clickNode('Ollama');
    await expect(configPanel.port).toHaveValue('11435');
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/node-config-panel.png', fullPage: true });
  });

  test('should handle network/service fields and API keys', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click OpenRouter
    await canvas.clickNode('Openrouter');
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

  test('should handle Google AI Studio API key entry and saving', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click Google AI Studio node
    await canvas.clickNode('AI Studio');
    await expect(configPanel.updateButton).toBeVisible();

    // Verify Google API Key field is password masked
    await expect(configPanel.googleApiKey).toHaveAttribute('type', 'password');

    // Fill Google API key and save
    await configPanel.googleApiKey.fill('AIzaSyMockGoogleKey123');
    await configPanel.updateButton.click();

    // Verify Tauri IPC was called for set_credential for google service
    const cmds = await page.evaluate(() => window['invokedCommands']);
    const setGoogleCall = cmds.find((c: any) => c.cmd === 'set_credential' && c.args?.service === 'google');
    expect(setGoogleCall).toBeDefined();
    expect(setGoogleCall.args.secret).toBe('AIzaSyMockGoogleKey123');
  });

  test('should restore Google AI Studio active status on startup when credentials exist', async ({ page }) => {
    // Override get_credential mock to return a key for google
    await page.addInitScript(() => {
      const origInvoke = (window as any).__TAURI_INTERNALS__?.invoke;
      if (origInvoke) {
        (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
          if (cmd === 'get_credential' && args?.service === 'google') {
            return Promise.resolve('AIzaSyMockGoogleKey123');
          }
          return origInvoke(cmd, args);
        };
      }
    });

    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Verify Google AI Studio node shows API Key prefix and status
    const googleNode = page.locator('[data-node-id="node-google"]');
    await expect(googleNode).toBeVisible();
    await expect(googleNode.getByText('AIzaS...')).toBeVisible();
    await expect(googleNode.getByText('200 OK')).toBeVisible();
  });

  test('should render FrugalLM Hub routing panel and filter computer-use models', async ({ page }) => {
    const canvas = new MainCanvas(page);
    
    await canvas.goto();

    // Click FrugalLM Hub node
    await canvas.clickNode('FrugaLLM');
    
    // Check that the panel opens
    await expect(page.getByRole('heading', { name: /FrugaLLM/i })).toBeVisible();

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

  test('should not show tool enforcing gateway option when Ollama is not installed', async ({ page }) => {
    // Override check_ollama_status mock to return false
    await page.addInitScript(() => {
      const origInvoke = (window as any).__TAURI_INTERNALS__?.invoke;
      if (origInvoke) {
        (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
          if (cmd === 'check_ollama_status') return Promise.resolve(false);
          return origInvoke(cmd, args);
        };
      }
    });

    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click Ollama node
    await canvas.clickNode('Ollama');
    await expect(configPanel.updateButton).toBeVisible();

    // Check that Ollama Missing is shown, and Tool Gateway is not shown
    await expect(page.getByText('OLLAMA MISSING')).toBeVisible();
    await expect(configPanel.toolGatewayCheckbox).not.toBeVisible();
  });

  test('should prompt and trigger installation for Tool Enforcing Gateway when not installed', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click Ollama node
    await canvas.clickNode('Ollama');
    await expect(configPanel.updateButton).toBeVisible();

    // Check that the Tool Enforcing Gateway checkbox is present and unchecked
    await expect(configPanel.toolGatewayCheckbox).toBeVisible();
    await expect(configPanel.toolGatewayCheckbox).not.toBeChecked();
    await expect(configPanel.toolGatewayStatus).toHaveText('NOT INSTALLED');

    // Clicking checkbox when not installed prompts user with confirmation dialog
    await configPanel.toolGatewayCheckbox.click();
    await expect(page.getByText('INSTALL TOOL ENFORCING GATEWAY?')).toBeVisible();
    await expect(configPanel.confirmInstallToolGatewayButton).toBeVisible();

    // Confirm installation
    await configPanel.confirmInstallToolGatewayButton.click();

    // Verify Terminal Runner opens in install-tool-gateway mode
    await expect(page.getByRole('heading', { name: 'Tool Enforcing Gateway' })).toBeVisible();
    
    // Verify set_tool_gateway_installed was called with installed: true
    await expect(async () => {
      const cmds = await page.evaluate(() => window['invokedCommands']);
      const installCall = cmds.find((c: any) => c.cmd === 'set_tool_gateway_installed' && c.args?.installed === true);
      expect(installCall).toBeDefined();
    }).toPass({ timeout: 10000 });
  });

  test('should prompt and trigger uninstallation for Tool Enforcing Gateway when installed', async ({ page }) => {
    // Override mocks so tool gateway is installed and enabled
    await page.addInitScript(() => {
      window['customInvokeHandler'] = (cmd: string) => {
        if (cmd === 'check_tool_gateway_status') return Promise.resolve(true);
        if (cmd === 'get_frugallm_config') return Promise.resolve({ tool_enforcing_gateway: true });
        return undefined;
      };
    });

    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click Ollama node
    await canvas.clickNode('Ollama');
    await expect(configPanel.updateButton).toBeVisible();

    // Check that the Tool Enforcing Gateway is marked INSTALLED and checked
    await expect(configPanel.toolGatewayStatus).toHaveText('INSTALLED');
    await expect(configPanel.toolGatewayCheckbox).toBeChecked();

    // Clicking checkbox to uncheck prompts user with uninstall dialog
    await configPanel.toolGatewayCheckbox.click();
    await expect(page.getByText('UNINSTALL TOOL ENFORCING GATEWAY?')).toBeVisible();
    await expect(configPanel.confirmUninstallToolGatewayButton).toBeVisible();

    // Confirm uninstallation
    await configPanel.confirmUninstallToolGatewayButton.click();

    // Verify Terminal Runner opens in uninstall-tool-gateway mode
    await expect(page.getByRole('heading', { name: 'Tool Enforcing Gateway' })).toBeVisible();

    // Verify set_tool_gateway_installed was called with installed: false
    await expect(async () => {
      const cmds = await page.evaluate(() => window['invokedCommands']);
      const uninstallCall = cmds.find((c: any) => c.cmd === 'set_tool_gateway_installed' && c.args?.installed === false);
      expect(uninstallCall).toBeDefined();
    }).toPass({ timeout: 5000 });
  });

  test('should toggle API password checkbox, show/hide password, and save new password on FrugaLLM node', async ({ page }) => {
    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click FrugaLLM Core node
    await canvas.clickNode('FrugaLLM');
    await expect(configPanel.updateButton).toBeVisible();

    // Checkbox should be visible and initially unchecked (no password set in default mock)
    await expect(configPanel.apiPasswordCheckbox).toBeVisible();
    await expect(configPanel.apiPasswordCheckbox).not.toBeChecked();
    await expect(configPanel.apiPasswordInput).not.toBeVisible();

    // Check the API Password checkbox
    await configPanel.apiPasswordCheckbox.click();
    await expect(configPanel.apiPasswordCheckbox).toBeChecked();
    await expect(configPanel.apiPasswordInput).toBeVisible();
    await expect(configPanel.apiPasswordInput).toHaveAttribute('type', 'password');

    // Type a password
    await configPanel.apiPasswordInput.fill('mySecretP@ss123');

    // Toggle Show/Hide
    await configPanel.togglePasswordVisibilityButton.click();
    await expect(configPanel.apiPasswordInput).toHaveAttribute('type', 'text');
    await configPanel.togglePasswordVisibilityButton.click();
    await expect(configPanel.apiPasswordInput).toHaveAttribute('type', 'password');

    // Click Copy password button
    await configPanel.copyPasswordButton.click();

    // Save changes
    await configPanel.updateButton.click();

    // Verify set_frugallm_config was called with api_password
    const cmds = await page.evaluate(() => window['invokedCommands']);
    const saveCall = cmds.find((c: any) => c.cmd === 'set_frugallm_config' && c.args?.newConfig?.api_password === 'mySecretP@ss123');
    expect(saveCall).toBeDefined();
  });

  test('should display existing API password active badge and clear password when unchecked and saved', async ({ page }) => {
    // Override get_frugallm_config mock to return existing password
    await page.addInitScript(() => {
      const origInvoke = (window as any).__TAURI_INTERNALS__?.invoke;
      if (origInvoke) {
        (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
          if (cmd === 'get_frugallm_config') {
            return Promise.resolve({
              port: 61721,
              bind_all_interfaces: false,
              api_password: 'existingSecret456'
            });
          }
          return origInvoke(cmd, args);
        };
      }
    });

    const canvas = new MainCanvas(page);
    const configPanel = new NodeConfigPanel(page);

    await canvas.goto();

    // Click FrugaLLM Core node
    await canvas.clickNode('FrugaLLM');
    await expect(configPanel.updateButton).toBeVisible();

    // Verify checkbox is checked and active status is shown
    await expect(configPanel.apiPasswordCheckbox).toBeChecked();
    await expect(configPanel.apiPasswordInput).toBeVisible();
    await expect(configPanel.apiPasswordInput).toHaveValue('existingSecret456');
    await expect(page.getByText('• ACTIVE')).toBeVisible();

    // Uncheck API password checkbox
    await configPanel.apiPasswordCheckbox.click();
    await expect(configPanel.apiPasswordCheckbox).not.toBeChecked();
    await expect(configPanel.apiPasswordInput).not.toBeVisible();

    // Save changes
    await configPanel.updateButton.click();

    // Verify set_frugallm_config was called with api_password: null
    const cmds = await page.evaluate(() => window['invokedCommands']);
    const saveCall = cmds.find((c: any) => c.cmd === 'set_frugallm_config' && c.args?.newConfig?.api_password === null);
    expect(saveCall).toBeDefined();
  });

  test('should display port conflict banner, error badge on FrugaLLM node, and allow editing port', async ({ page }) => {
    await page.addInitScript(() => {
      const origInvoke = (window as any).__TAURI_INTERNALS__?.invoke;
      if (origInvoke) {
        (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
          if (cmd === 'get_frugallm_server_status') {
            return Promise.resolve({
              status: 'PortConflict',
              data: {
                port: 5050,
                ip: '127.0.0.1',
                message: 'Close the service currently using port [5050] and restart the app.',
              },
            });
          }
          if (cmd === 'get_frugallm_config') {
            return Promise.resolve({
              port: 5050,
              bind_all_interfaces: false,
              api_password: '',
            });
          }
          return origInvoke(cmd, args);
        };
      }
    });

    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Verify Port Conflict Banner is visible
    const banner = page.getByTestId('port-conflict-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('PORT CONFLICT DETECTED');
    await expect(banner).toContainText('Close the service currently using port [5050] and restart the app.');

    // Verify FrugaLLM node badge
    const badge = page.getByTestId('frugallm-port-conflict-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('PORT CONFLICT');

    // Click "Configure Port" in the banner
    await page.getByTestId('port-conflict-configure').click();

    // Verify the Hub settings panel opens with editable port field
    const portInput = page.getByTestId('input-frugallm-port');
    await expect(portInput).toBeVisible();
    await expect(portInput).toHaveValue('5050');
    await expect(page.getByTestId('port-conflict-hint')).toBeVisible();

    const configPanel = new NodeConfigPanel(page);

    // Edit port to 61722 and save
    await portInput.fill('61722');
    await configPanel.updateButton.click();

    // Verify set_frugallm_config was invoked with port 61722
    const cmds = await page.evaluate(() => window['invokedCommands']);
    const saveCall = cmds.find((c: any) => c.cmd === 'set_frugallm_config' && c.args?.newConfig?.port === 61722);
    expect(saveCall).toBeDefined();
  });
});
