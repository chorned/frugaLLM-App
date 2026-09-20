import { Page, Locator } from '@playwright/test';

export class HardwareTelemetryPage {
  readonly page: Page;
  readonly container: Locator;
  readonly headerTitle: Locator;
  readonly statusLight: Locator;
  readonly activeModel: Locator;
  readonly allocation: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('#node-ollama');
    this.headerTitle = this.container.getByText('Ollama', { exact: false }).first();
    this.allocation = this.container.getByTestId('hardware-node-allocation');
    this.statusLight = this.container.getByTestId('node-ollama-status');
    this.activeModel = this.container.locator('[data-testid="active-model-name"]');
    this.settingsButton = this.container.getByTestId('hardware-settings-btn');
  }

  // Helper to emit events to the mock
  async emitTelemetry(payload: any) {
    await this.container.waitFor({ state: 'visible' });
    await this.page.evaluate((data) => {
      (window as any).emitTauriEvent('telemetry_update', data);
    }, payload);
  }
}
