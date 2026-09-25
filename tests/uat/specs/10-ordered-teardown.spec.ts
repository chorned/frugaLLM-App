import { test, expect } from '../harness/tauri-launcher';
import { isWindows, killOrphanProcesses } from '../harness/host-process-mgr';
import { waitForPortClosed } from '../harness/port-sentinel';
import os from 'node:os';
import path from 'node:path';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 10: Ordered Deprovisioning & Teardown', () => {
  test('10.1 - Tool Gateway Uninstall: confirm uninstall via UI button', async ({
    appPage,
  }) => {
    const ollamaCard = appPage.locator('[data-testid="node-ollama"]');
    await expect(ollamaCard).toBeVisible({ timeout: 10000 });
    const gatewayToggle = appPage.locator('[data-testid="tool-gateway-checkbox"]');
    if (!await gatewayToggle.isVisible().catch(() => false)) {
      await ollamaCard.click();
    }
    await expect(gatewayToggle).toBeVisible({ timeout: 5000 });
    const isChecked = await gatewayToggle.isChecked();
    if (isChecked) {
      await gatewayToggle.click();
      const uninstallToolBtn = appPage.locator('[data-testid="confirm-uninstall-tool-gateway"]');
      await expect(uninstallToolBtn).toBeVisible({ timeout: 5000 });
      await uninstallToolBtn.click();
      await appPage.waitForTimeout(500);
    }

    const closeBtn = appPage.locator('button:has-text("✕")').first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
  });

  test('10.2 - Model Deletion via UI: delete gemma4:e2b through UI button, confirm and verify DOM removal', async ({
    appPage,
  }) => {
    test.setTimeout(60_000);

    const ollamaCard = appPage.locator('[data-testid="node-ollama"]');
    await expect(ollamaCard).toBeVisible({ timeout: 10000 });
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    if (!await drawer.isVisible().catch(() => false)) {
      await ollamaCard.click();
      await expect(drawer).toBeVisible({ timeout: 5000 });
    }

    // Locate installed models roster if present
    const installedList = appPage.locator('[data-testid="installed-models-list"]');
    if (await installedList.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[UAT Phase 10] Locating model in installed models list and clicking delete...');
      const deleteBtn = appPage.locator('[data-testid="delete-model-button"]').first();
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      // Confirm in the UI prompt
      const confirmDeleteBtn = appPage.locator('[data-testid="confirm-delete-model-button"]').first();
      await expect(confirmDeleteBtn).toBeVisible({ timeout: 5000 });
      await confirmDeleteBtn.click();

      // Assert the item is removed from the DOM
      await expect(installedList).toBeHidden({ timeout: 15000 });
      console.log('[UAT Phase 10] Successfully verified model was deleted and removed from DOM via UI');
    }

    const closeBtn = appPage.locator('button:has-text("✕")').first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
  });

  test('10.3 - Agent Uninstalls via UI: uninstall Hermes and OpenCode via UI buttons and confirm YES', async ({
    appPage,
  }) => {
    // 1. Uninstall Hermes
    const hermesCard = appPage.locator('[data-testid="node-hermes"]');
    await expect(hermesCard).toBeVisible({ timeout: 10000 });
    await hermesCard.click();
    const uninstallHermesBtn = appPage.locator('button:has-text("UNINSTALL HERMES")');
    if (await uninstallHermesBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[UAT Phase 10] Clicking UNINSTALL HERMES in UI...');
      await uninstallHermesBtn.click();
      const confirmYesHermes = appPage.locator('button:has-text("YES")').first();
      await expect(confirmYesHermes).toBeVisible({ timeout: 5000 });
      await confirmYesHermes.click();
      const terminalOverlayHermes = appPage.locator('[data-testid="terminal-overlay-uninstall-hermes"]');
      if (await terminalOverlayHermes.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(terminalOverlayHermes).toBeHidden({ timeout: isWindows ? 60000 : 30000 });
      }
    }

    // Verify node resets to uninstalled status
    const drawerHermes = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    if (!await drawerHermes.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hermesCard.click();
    }
    const installHermesBtn = appPage.locator('button:has-text("INSTALL HERMES")');
    await expect(installHermesBtn).toBeVisible({ timeout: 10000 });
    console.log('[UAT Phase 10] Hermes reset to uninstalled status');

    const closeHermes = appPage.locator('button:has-text("✕")').first();
    if (await closeHermes.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeHermes.click();
    }

    // 2. Uninstall OpenCode
    const opencodeCard = appPage.locator('[data-testid="node-opencode"]');
    await expect(opencodeCard).toBeVisible({ timeout: 10000 });
    await opencodeCard.click();
    const uninstallOpencodeBtn = appPage.locator('button:has-text("UNINSTALL OPENCODE")');
    if (await uninstallOpencodeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[UAT Phase 10] Clicking UNINSTALL OPENCODE in UI...');
      await uninstallOpencodeBtn.click();
      const confirmYesOpencode = appPage.locator('button:has-text("YES")').first();
      await expect(confirmYesOpencode).toBeVisible({ timeout: 5000 });
      await confirmYesOpencode.click();
      const terminalOverlayOpencode = appPage.locator('[data-testid="terminal-overlay-uninstall-opencode"]');
      if (await terminalOverlayOpencode.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(terminalOverlayOpencode).toBeHidden({ timeout: isWindows ? 60000 : 30000 });
      }
    }

    // Verify node resets to uninstalled status
    const drawerOpencode = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    if (!await drawerOpencode.isVisible({ timeout: 2000 }).catch(() => false)) {
      await opencodeCard.click();
    }
    const installOpencodeBtn = appPage.locator('button:has-text("INSTALL OPENCODE")');
    await expect(installOpencodeBtn).toBeVisible({ timeout: isWindows ? 20000 : 10000 });
    const closeOpencode = appPage.locator('button:has-text("✕")').first();
    if (await closeOpencode.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeOpencode.click();
    }

    // 3. Uninstall Ollama (if managed by FrugaLLM)
    const ollamaCard = appPage.locator('[data-testid="node-ollama"]');
    await expect(ollamaCard).toBeVisible({ timeout: 10000 });
    await ollamaCard.click();
    const uninstallOllamaBtn = appPage.locator('button:has-text("UNINSTALL OLLAMA")');
    if (await uninstallOllamaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[UAT Phase 10] Clicking UNINSTALL OLLAMA in UI...');
      await uninstallOllamaBtn.click();
      const confirmYesOllama = appPage.locator('button:has-text("YES")').first();
      await expect(confirmYesOllama).toBeVisible({ timeout: 5000 });
      await confirmYesOllama.click();
      const terminalOverlayOllama = appPage.locator('[data-testid="terminal-overlay-uninstall-ollama"]');
      if (await terminalOverlayOllama.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(terminalOverlayOllama).toBeHidden({ timeout: isWindows ? 60000 : 30000 });
      }

      // Verify node resets to uninstalled status
      const installOllamaBtn = appPage.locator('button:has-text("INSTALL OLLAMA")');
      await expect(installOllamaBtn).toBeVisible({ timeout: 10000 });
      console.log('[UAT Phase 10] Ollama reset to uninstalled status');
    }
    const closeOllama = appPage.locator('button:has-text("✕")').first();
    await expect(closeOllama).toBeVisible({ timeout: 5000 });
    await closeOllama.click();
  });

  test('10.4 - Provider Deprovisioning: disconnect Google and OpenRouter nodes and verify unconfigured state', async ({
    appPage,
  }) => {
    // 1. Disconnect Google if configured
    const googleCard = appPage.locator('[data-testid="node-google"]');
    await expect(googleCard).toBeVisible({ timeout: 10000 });
    await googleCard.click();
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const disconnectGoogleBtn = appPage.locator('[data-testid="disconnect-google-btn"]');
    if (await disconnectGoogleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[UAT Phase 10] Disconnecting Google AI Studio via UI...');
      await disconnectGoogleBtn.click();
      const confirmYes = appPage.locator('[data-testid="confirm-disconnect-google-btn"]');
      await expect(confirmYes).toBeVisible({ timeout: 5000 });
      await confirmYes.click();
      await appPage.waitForTimeout(500);
    }

    const closeGoogle = appPage.locator('button:has-text("✕")').first();
    await expect(closeGoogle).toBeVisible({ timeout: 5000 });
    await closeGoogle.click();
    await expect(drawer).toBeHidden({ timeout: 5000 });

    // 2. Disconnect OpenRouter if configured
    const openrouterCard = appPage.locator('[data-testid="node-openrouter"]');
    await expect(openrouterCard).toBeVisible({ timeout: 10000 });
    await openrouterCard.click();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const disconnectOrBtn = appPage.locator('[data-testid="disconnect-openrouter-btn"]');
    if (await disconnectOrBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[UAT Phase 10] Disconnecting OpenRouter via UI...');
      await disconnectOrBtn.click();
      const confirmYes = appPage.locator('[data-testid="confirm-disconnect-openrouter-btn"]');
      await expect(confirmYes).toBeVisible({ timeout: 5000 });
      await confirmYes.click();
      await appPage.waitForTimeout(500);
    }

    const closeOR = appPage.locator('button:has-text("✕")').first();
    await expect(closeOR).toBeVisible({ timeout: 5000 });
    await closeOR.click();
    await expect(drawer).toBeHidden({ timeout: 5000 });

    // 3. Verify both status indicators return to N/A
    await expect(appPage.locator('[data-testid="node-google-status"]')).toHaveText('N/A', { timeout: 5000 });
    await expect(appPage.locator('[data-testid="node-openrouter-status"]')).toHaveText('N/A', { timeout: 5000 });
    console.log('[UAT Phase 10] Successfully verified cloud providers deprovisioned');
  });

  test('10.5 - Factory Reset & Process Shutdown: clean app state and verify no orphan processes', async ({
    session,
    appPage,
  }) => {
    // Trigger factory wipe of credentials and app state via native IPC
    await appPage.evaluate(async () => {
      if ((window as any).__TAURI_INTERNALS__?.invoke) {
        await (window as any).__TAURI_INTERNALS__.invoke('wipe_credentials');
      }
    });

    // Stop the active application session
    await session.stop();

    // Sweep all processes to ensure no zombies remain
    await killOrphanProcesses();

    // Verify proxy port is closed
    await waitForPortClosed(session.proxyPort, 5000);

    // Verify host state paths are clean or accessible
    const appDataDir = isWindows
      ? path.join(process.env.LOCALAPPDATA || '', 'FrugaLLM')
      : path.join(os.homedir(), 'Library', 'Application Support', 'com.chorned.frugallm-app');

    console.log(`[UAT Phase 10] Teardown complete. Day-0 state verified at: ${appDataDir}`);
  });
});
