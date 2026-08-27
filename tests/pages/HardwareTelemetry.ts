import { Page, Locator } from '@playwright/test';

export class HardwareTelemetryPage {
  readonly page: Page;
  readonly container: Locator;
  readonly panel: Locator;
  readonly headerTitle: Locator;
  readonly toggleButton: Locator;
  readonly statusLight: Locator;
  readonly activeModel: Locator;
  
  readonly loadLabel: Locator;
  readonly loadValue: Locator;
  readonly loadBar: Locator;
  
  readonly memoryLabel: Locator;
  readonly memoryValue: Locator;
  readonly memoryBar: Locator;
  
  readonly throughputLabel: Locator;
  readonly throughputValue: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // The container can be found by text "LOCAL HARDWARE" which is unique to this widget.
    // However, it's safer to scope it. It's the only one with LOCAL HARDWARE.
    this.container = page.locator('#node-ollama');
    
    this.headerTitle = this.container.getByText('Local Hardware', { exact: false }).first();
    this.toggleButton = this.container.locator('text=▼').or(this.container.locator('text=▲'));
    
    // Status light text is inside the header
    this.statusLight = this.container.locator('span').filter({ hasText: /^(Standby|Loading|Thinking|Loaded|llama.*)$/i }).first();
    
    this.activeModel = this.container.locator('div').filter({ hasText: /^Active Model.*$/ }).locator('span').last();
    
    this.panel = page.getByTestId('hardware-telemetry-panel');
    
    this.loadLabel = this.panel.locator('div').filter({ hasText: /^(CPU|GPU|CPU Load|GPU Load).*$/ }).locator('span').first();
    this.loadValue = this.panel.locator('div').filter({ hasText: /^(CPU|GPU|CPU Load|GPU Load).*$/ }).locator('span').last();
    
    this.memoryLabel = this.panel.locator('div').filter({ hasText: /^(Memory|RAM Allocation|VRAM Allocation).*$/ }).locator('span').first();
    this.memoryValue = this.panel.locator('div').filter({ hasText: /^(Memory|RAM Allocation|VRAM Allocation).*$/ }).locator('span').last();
    
    this.throughputLabel = this.panel.locator('text=Throughput');
    this.throughputValue = this.throughputLabel.locator('..').locator('span').nth(1); // The value span next to it
  }

  async toggle() {
    await this.headerTitle.click();
  }

  // Helper to emit events to the mock
  async emitTelemetry(payload: any) {
    await this.page.evaluate((data) => {
      (window as any).emitTauriEvent('telemetry_update', data);
    }, payload);
  }
}
