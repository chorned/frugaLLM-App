import { expect, type Locator, type Page } from '@playwright/test';

export class NodeConfigPanel {
  readonly page: Page;
  
  // Agent Fields
  readonly schemaPath: Locator;
  readonly cwd: Locator;
  readonly bin: Locator;
  readonly extraArgs: Locator;
  readonly prompt: Locator;

  // Network/Service Fields
  readonly ip: Locator;
  readonly port: Locator;
  readonly apiKey: Locator;
  readonly googleApiKey: Locator;
  readonly apiPasswordCheckbox: Locator;
  readonly apiPasswordInput: Locator;
  readonly togglePasswordVisibilityButton: Locator;
  readonly copyPasswordButton: Locator;

  // Tool Enforcing Gateway
  readonly toolGatewayCheckbox: Locator;
  readonly toolGatewayStatus: Locator;
  readonly confirmInstallToolGatewayButton: Locator;
  readonly confirmUninstallToolGatewayButton: Locator;

  // Actions
  readonly updateButton: Locator;
  readonly helpButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.schemaPath = page.locator('input[name="schemaPath"]');
    this.cwd = page.locator('input[name="cwd"]');
    this.bin = page.locator('input[name="bin"]');
    this.extraArgs = page.locator('input[name="extraArgs"]');
    this.prompt = page.locator('textarea[name="prompt"]');

    this.ip = page.locator('input[name="ip"]');
    this.port = page.locator('input[name="port"]');
    this.apiKey = page.locator('input[name="apiKey"]');
    this.googleApiKey = page.locator('input[name="googleApiKey"]');
    this.apiPasswordCheckbox = page.getByTestId('api-password-checkbox');
    this.apiPasswordInput = page.getByTestId('api-password-input');
    this.togglePasswordVisibilityButton = page.getByTestId('toggle-password-visibility');
    this.copyPasswordButton = page.getByTestId('copy-password-button');

    this.toolGatewayCheckbox = page.getByTestId('tool-gateway-checkbox');
    this.toolGatewayStatus = page.getByTestId('tool-gateway-status');
    this.confirmInstallToolGatewayButton = page.getByTestId('confirm-install-tool-gateway');
    this.confirmUninstallToolGatewayButton = page.getByTestId('confirm-uninstall-tool-gateway');

    this.updateButton = page.getByRole('button', { name: /SAVE CHANGES/i });
    this.helpButton = page.getByRole('button', { name: /HELP/ });
    this.closeButton = page.getByRole('button', { name: '✕' }).first(); // the config panel close button
  }

  async getTooltipText(labelContainer: Locator) {
    return labelContainer.locator('.tooltip-text');
  }
}
