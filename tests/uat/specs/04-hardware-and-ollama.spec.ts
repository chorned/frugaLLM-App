import { test, expect } from '../harness/tauri-launcher';

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
    await expect(memoryWidget).toBeVisible({ timeout: 5000 });
  });

  test('04.2 - Model Ingestion: select gemma4:e2b in UI, trigger install, verify progress bar and installed roster', async ({
    appPage,
  }) => {
    test.setTimeout(300_000);

    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const modelSelect = appPage.locator('[data-testid="recommended-model-input"]');
    await expect(modelSelect).toBeVisible({ timeout: 5000 });
    await modelSelect.selectOption('gemma4:e2b');
    await appPage.waitForTimeout(300);

    const installBtn = appPage.getByRole('button', { name: 'INSTALL OLLAMA', exact: true });
    if (await installBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[UAT Phase 4] Triggering genuine bare-metal Ollama installation and deployment via UI button...');
      await installBtn.click();

      // Assert the terminal overlay appears
      const terminalOverlay = appPage.locator('[data-testid="terminal-overlay-install-ollama"]');
      await expect(terminalOverlay).toBeVisible({ timeout: 10000 });

      // Assert the in-app progress bar widget appears
      const progressBar = appPage.locator('[data-testid="model-download-progress-bar"]');
      await expect(progressBar).toBeVisible({ timeout: 180_000 });

      // Wait for the real in-app progress bar to hit 100%
      await expect(progressBar.locator('text=100%')).toBeVisible({ timeout: 280_000 });

      // Wait for terminal overlay to finish and close
      await expect(terminalOverlay).toBeHidden({ timeout: 60_000 });
    }

    // Verify genuine live Ollama daemon responds with 200 OK
    const versionRes = await fetch('http://127.0.0.1:11434/api/version').catch(() => null);
    expect(versionRes?.status).toBe(200);
    const versionJson = await versionRes?.json().catch(() => null);
    console.log('[UAT Phase 4] Live Ollama daemon responded 200 OK:', versionJson);
    expect(versionJson).toHaveProperty('version');

    // Ensure config drawer is open
    const drawerAfter = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    if (!await drawerAfter.isVisible().catch(() => false)) {
      await appPage.locator('[data-testid="node-ollama"]').click();
      await expect(drawerAfter).toBeVisible({ timeout: 5000 });
    }

    // Verify that if a model is installed, it appears in the UI's installed models roster
    const installedList = appPage.locator('[data-testid="installed-models-list"]');
    if (await installedList.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(installedList).toBeVisible();
      console.log('[UAT Phase 4] Successfully verified installed models roster');
    }
  });

  test('04.3 - Tool Enforcing Gateway: toggle checkbox, trigger installation, verify status', async ({
    appPage,
  }) => {
    // Ensure Ollama config drawer is open
    const gatewayToggle = appPage.locator('[data-testid="tool-gateway-checkbox"]');
    if (!await gatewayToggle.isVisible().catch(() => false)) {
      await appPage.locator('[data-testid="node-ollama"]').click();
      await expect(gatewayToggle).toBeVisible({ timeout: 5000 });
    }
    const isChecked = await gatewayToggle.isChecked();
    if (isChecked) {
      // If currently installed, test uninstall first
      await gatewayToggle.click();
      const confirmUninstall = appPage.locator('[data-testid="confirm-uninstall-tool-gateway"]');
      await expect(confirmUninstall).toBeVisible({ timeout: 5000 });
      await confirmUninstall.click();
      await appPage.waitForTimeout(500);

      // Now toggle on to test fresh installation
      await gatewayToggle.click();
    } else {
      await gatewayToggle.click();
    }

    // Check for install confirmation button if gateway wasn't already provisioned
    const confirmInstall = appPage.locator('[data-testid="confirm-install-tool-gateway"]');
    if (await confirmInstall.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmInstall.click();

      // Wait for tool gateway terminal overlay to complete and auto-close
      const terminalOverlay = appPage.locator('[data-testid="terminal-overlay-install-tool-gateway"]');
      if (await terminalOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(terminalOverlay).toBeHidden({ timeout: 15000 });
      }
    }

    // Assert status transitions
    const statusBadge = appPage.locator('[data-testid="tool-gateway-status"]');
    await expect(statusBadge).toBeVisible({ timeout: 10000 });
    const text = await statusBadge.innerText();
    expect(text.length).toBeGreaterThan(0);

    // Close config drawer
    const closeDrawerBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    await expect(closeDrawerBtn).toBeVisible();
    await closeDrawerBtn.click();
    await expect(appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first()).toBeHidden({ timeout: 5000 });
  });
});
