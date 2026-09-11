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
  readonly memoryLabel: Locator;
  readonly memoryValue: Locator;
  readonly throughputLabel: Locator;
  readonly throughputValue: Locator;
  readonly benchmarkButton: Locator;
  readonly benchmarkPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // The container can be found by text "LOCAL HARDWARE" which is unique to this widget.
    // However, it's safer to scope it. It's the only one with LOCAL HARDWARE.
    this.container = page.locator('#node-ollama');
    
    this.headerTitle = this.container.getByText('Ollama', { exact: false }).first();
    this.toggleButton = this.container.getByTestId('hardware-telemetry-trigger');
    
    // Status light text is inside the header
    this.statusLight = this.container.locator('span').filter({ hasText: /^(Standby|Loading|Thinking|Loaded|llama.*)$/i }).first();
    
    this.activeModel = this.container.locator('[data-testid="active-model-name"]');
    
    this.panel = page.getByTestId('hardware-telemetry-panel');
    
    this.loadLabel = this.panel.getByTestId('telemetry-load-label');
    this.loadValue = this.panel.getByTestId('telemetry-load-value');
    
    this.memoryLabel = this.panel.getByTestId('telemetry-memory-label');
    this.memoryValue = this.panel.getByTestId('telemetry-memory-value');
    
    this.throughputLabel = this.panel.locator('text=Avg. Throughput');
    this.throughputValue = this.panel.getByTestId('live-throughput-stat');
    this.benchmarkButton = this.panel.getByTestId('benchmark-toggle');
    this.benchmarkPanel = this.panel.getByTestId('benchmark-panel');
  }

  async toggle() {
    await this.toggleButton.click();
  }

  async toggleBenchmarks() {
    await this.benchmarkButton.click();
  }

  // Helper to emit events to the mock
  async emitTelemetry(payload: any) {
    await this.page.evaluate((data) => {
      (window as any).emitTauriEvent('telemetry_update', data);
    }, payload);
  }
}
