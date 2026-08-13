import { Page, Locator } from '@playwright/test';

export class HardwareTelemetryPage {
  readonly page: Page;
  readonly container: Locator;
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
    this.container = page.locator('div').filter({ hasText: /^LOCAL HARDWARE(▼|▲)?.*$/ }).first();
    
    this.headerTitle = this.container.locator('text=LOCAL HARDWARE');
    this.toggleButton = this.container.locator('text=▼').or(this.container.locator('text=▲'));
    
    // Status light text is inside the header
    this.statusLight = this.container.locator('div > span').filter({ hasText: /^(IDLE|LOADING|THINKING|LOADED|ROUTING)$/ });
    
    this.activeModel = page.locator('div').filter({ hasText: /^Active Model.*$/ }).locator('span').last();
    
    this.loadLabel = page.locator('div').filter({ hasText: /^(CPU Load|GPU Load).*$/ }).locator('span').first();
    this.loadValue = page.locator('div').filter({ hasText: /^(CPU Load|GPU Load).*$/ }).locator('span').last();
    
    this.memoryLabel = page.locator('div').filter({ hasText: /^(RAM Allocation|VRAM Allocation).*$/ }).locator('span').first();
    this.memoryValue = page.locator('div').filter({ hasText: /^(RAM Allocation|VRAM Allocation).*$/ }).locator('span').last();
    
    this.throughputLabel = page.locator('text=Throughput');
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
