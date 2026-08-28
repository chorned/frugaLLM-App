import { expect, type Locator, type Page } from '@playwright/test';

export class TerminalRunner {
  readonly page: Page;
  
  readonly container: Locator;
  readonly xterm: Locator;
  readonly closeButton: Locator;
  readonly confirmCloseText: Locator;
  readonly yesButton: Locator;
  readonly cancelButton: Locator;
  readonly downloadSpeed: Locator;
  readonly downloadEta: Locator;
  readonly downloadSize: Locator;

  constructor(page: Page) {
    this.page = page;

    // The TerminalView container
    this.container = page.locator('div').filter({ hasText: '✕' }).first();
    this.xterm = page.locator('.xterm');
    this.closeButton = page.getByRole('button', { name: '✕' });
    this.confirmCloseText = page.getByText('This will terminate the running process. Are you sure?');
    this.yesButton = page.getByRole('button', { name: 'Yes' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.provisioningBar = page.getByText('Downloading Weights...');
    this.downloadSpeed = page.getByTestId('download-speed');
    this.downloadEta = page.getByTestId('download-eta');
    this.downloadSize = page.getByTestId('download-size');
  }
}
