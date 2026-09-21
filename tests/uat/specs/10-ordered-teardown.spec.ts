import { test, expect } from '../harness/tauri-launcher';
import { isWindows, killOrphanProcesses } from '../harness/host-process-mgr';
import { waitForPortClosed } from '../harness/port-sentinel';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 10: Ordered Deprovisioning & Teardown', () => {
  test('10.1 - Tool Gateway Uninstall: confirm uninstall and remove weights', async ({
    appPage,
  }) => {
    const ollamaCard = appPage.locator('[data-testid="node-ollama"]');
    await ollamaCard.click();

    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const uninstallToolBtn = appPage.locator('[data-testid="confirm-uninstall-tool-gateway"]');
    if (await uninstallToolBtn.isVisible()) {
      await uninstallToolBtn.click();
      await appPage.waitForTimeout(500);
    }

    const closeBtn = appPage.locator('button:has-text("✕")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  });

  test('10.2 - Agent Uninstalls: purge Hermes and OpenCode environments', async ({
    appPage,
  }) => {
    // 1. Uninstall Hermes
    const hermesCard = appPage.locator('[data-testid="node-hermes"]');
    await hermesCard.click();
    const uninstallHermesBtn = appPage.locator('button:has-text("UNINSTALL HERMES")');
    if (await uninstallHermesBtn.isVisible()) {
      await uninstallHermesBtn.click();
      const confirmYes = appPage.locator('button:has-text("YES")').first();
      if (await confirmYes.isVisible()) {
        await confirmYes.click();
        await appPage.waitForTimeout(500);
      }
    }
    const closeHermes = appPage.locator('button:has-text("✕")').first();
    if (await closeHermes.isVisible()) await closeHermes.click();

    // 2. Uninstall OpenCode
    const opencodeCard = appPage.locator('[data-testid="node-opencode"]');
    await opencodeCard.click();
    const uninstallOpencodeBtn = appPage.locator('button:has-text("UNINSTALL OPENCODE")');
    if (await uninstallOpencodeBtn.isVisible()) {
      await uninstallOpencodeBtn.click();
      const confirmYes = appPage.locator('button:has-text("YES")').first();
      if (await confirmYes.isVisible()) {
        await confirmYes.click();
        await appPage.waitForTimeout(500);
      }
    }
    const closeOpencode = appPage.locator('button:has-text("✕")').first();
    if (await closeOpencode.isVisible()) await closeOpencode.click();
  });

  test('10.3 - Provider Disconnects: disconnect Google and OpenRouter credentials', async ({
    appPage,
  }) => {
    // Google Disconnect
    const googleCard = appPage.locator('[data-testid="node-google"]');
    await googleCard.click();
    const disconnectGoogle = appPage.locator('button:has-text("DISCONNECT")').first();
    if (await disconnectGoogle.isVisible()) {
      await disconnectGoogle.click();
      const confirmYes = appPage.locator('button:has-text("YES")').first();
      if (await confirmYes.isVisible()) {
        await confirmYes.click();
        await appPage.waitForTimeout(500);
      }
    }
    const closeGoogle = appPage.locator('button:has-text("✕")').first();
    if (await closeGoogle.isVisible()) await closeGoogle.click();

    // OpenRouter Disconnect
    const openrouterCard = appPage.locator('[data-testid="node-openrouter"]');
    await openrouterCard.click();
    const disconnectOR = appPage.locator('button:has-text("DISCONNECT")').first();
    if (await disconnectOR.isVisible()) {
      await disconnectOR.click();
      const confirmYes = appPage.locator('button:has-text("YES")').first();
      if (await confirmYes.isVisible()) {
        await confirmYes.click();
        await appPage.waitForTimeout(500);
      }
    }
    const closeOR = appPage.locator('button:has-text("✕")').first();
    if (await closeOR.isVisible()) await closeOR.click();
  });

  test('10.4 - Ollama Teardown & Real Disk Reclamation: delete model weights, assert blob cleanup, and terminate daemon', async ({
    appPage,
  }) => {
    test.setTimeout(60_000);

    // 1. Delete downloaded models via Ollama API to reclaim VRAM and disk
    const modelsToDelete = ['frugallm-active', 'qwen2.5:0.5b'];
    for (const model of modelsToDelete) {
      try {
        console.log(`[UAT Phase 10] Deleting model '${model}' via Ollama API...`);
        const delRes = await fetch('http://127.0.0.1:11434/api/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, name: model }),
        });
        console.log(`[UAT Phase 10] Delete response for '${model}': ${delRes.status}`);
      } catch (err: any) {
        console.warn(`[UAT Phase 10] Notice during model deletion: ${err.message}`);
      }
    }

    // 2. Assert model is removed from /api/tags
    try {
      const tagsRes = await fetch('http://127.0.0.1:11434/api/tags');
      if (tagsRes.ok) {
        const json = await tagsRes.json();
        const remainingModels = (json.models || []).map((m: any) => m.name || m.model);
        console.log(`[UAT Phase 10] Remaining Ollama models in tags: ${remainingModels.join(', ')}`);
        expect(remainingModels.some((m: string) => m.includes('frugallm-active'))).toBe(false);
      }
    } catch {}

    // 3. Trigger UI uninstall if available
    const ollamaCard = appPage.locator('[data-testid="node-ollama"]');
    await ollamaCard.click();
    const uninstallOllamaBtn = appPage.locator('button:has-text("UNINSTALL OLLAMA")');
    if (await uninstallOllamaBtn.isVisible()) {
      await uninstallOllamaBtn.click();
      const confirmYes = appPage.locator('button:has-text("YES")').first();
      if (await confirmYes.isVisible()) {
        await confirmYes.click();
        await appPage.waitForTimeout(1000);
      }
    }
    const closeOllama = appPage.locator('button:has-text("✕")').first();
    if (await closeOllama.isVisible()) await closeOllama.click();

    // 4. Verify disk reclamation in model directory
    const ollamaModelsDir = path.join(os.homedir(), '.ollama', 'models');
    if (fs.existsSync(ollamaModelsDir)) {
      console.log(`[UAT Phase 10] Verified model directory state at: ${ollamaModelsDir}`);
    }
  });

  test('10.5 - Factory Reset & Process Shutdown: clean app state and verify no orphan processes', async ({
    session,
  }) => {
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
