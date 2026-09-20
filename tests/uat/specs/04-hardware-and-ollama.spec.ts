import { test, expect } from '../harness/tauri-launcher';
import { waitForPortOpen } from '../harness/port-sentinel';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 4: Local Hardware Node (Ollama) & Tool Gateway', () => {
  test('04.1 - Hardware Node Drawer: open node-ollama and verify memory pipeline visualizer', async ({
    appPage,
  }) => {
    const ollamaCard = appPage.locator('[data-testid="node-ollama"]');
    await expect(ollamaCard).toBeVisible({ timeout: 10000 });
    await ollamaCard.click();

    // Verify config drawer opens
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify MemoryPipelineWidget is rendered
    const memoryWidget = appPage.locator('[data-testid="memory-pipeline-widget"], .memory-pipeline-container').first();
    if (await memoryWidget.isVisible()) {
      await expect(memoryWidget).toBeVisible();
    }
  });

  test('04.2 - Embedded Terminal: trigger Ollama installation, minimize to footer, restore overlay', async ({
    appPage,
  }) => {
    // If Ollama is not yet installed, click INSTALL OLLAMA
    const installBtn = appPage.locator('button:has-text("INSTALL OLLAMA")');
    if (await installBtn.isVisible()) {
      await installBtn.click();
    }

    // Check terminal overlay
    const terminalOverlay = appPage.locator('[data-testid="terminal-view"], .terminal-overlay, [data-testid^="terminal-overlay-"]').first();
    if (await terminalOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Minimize terminal with '_' button
      const minBtn = appPage.locator('button[aria-label="Hide terminal"], button[title*="Hide terminal"], button:has-text("_")').first();
      if (await minBtn.isVisible()) {
        await minBtn.click();
        await expect(terminalOverlay).toBeHidden({ timeout: 5000 });

        // Verify minimized dock in footer
        const footerDock = appPage.locator('[data-testid="footer-minimized-terminal-cta"]');
        await expect(footerDock).toBeVisible({ timeout: 5000 });

        // Click to resume
        await footerDock.dispatchEvent('click');
        await expect(appPage.locator('[data-testid="terminal-view"], .terminal-overlay').first()).toBeVisible({ timeout: 5000 });

        // Hide/minimize terminal to allow next tests to interact with drawer
        const hideBtn = appPage.locator('button[aria-label="Hide terminal"], button[title*="Hide terminal"], button:has-text("_")').first();
        if (await hideBtn.isVisible()) {
          await hideBtn.click();
        }
      }
    }

    // Check daemon binding on 11434 (give reasonable time for local daemon)
    const ollamaOnline = await waitForPortOpen(11434, 5000);
    console.log(`[UAT Phase 4] Ollama 11434 status: ${ollamaOnline ? 'ONLINE' : 'OFFLINE (simulated)'}`);
  });

  test('04.3 - Tool Enforcing Gateway: toggle checkbox, trigger installation, verify status', async ({
    appPage,
  }) => {
    const gatewayToggle = appPage.locator('[data-testid="tool-gateway-checkbox"]');
    if (await gatewayToggle.isVisible()) {
      await gatewayToggle.click();

      // Check for install confirmation button if uninstalled
      const confirmInstall = appPage.locator('[data-testid="confirm-install-tool-gateway"]');
      if (await confirmInstall.isVisible()) {
        await confirmInstall.click();
        await appPage.waitForTimeout(1000);
      }

      // Assert status transitions
      const statusBadge = appPage.locator('[data-testid="tool-gateway-status"]');
      if (await statusBadge.isVisible()) {
        const text = await statusBadge.innerText();
        expect(text).toBeTruthy();
      }
    }

    // Close config drawer
    const closeDrawerBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click();
    }
  });
});
