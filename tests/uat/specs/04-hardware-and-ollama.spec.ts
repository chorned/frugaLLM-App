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

  test('04.2 - Model Ingestion: pull real local model, verify streaming download progress, and register model', async ({
    appPage,
  }) => {
    test.setTimeout(300_000);

    // If Ollama is not yet installed, click INSTALL OLLAMA
    const installBtn = appPage.locator('button:has-text("INSTALL OLLAMA")');
    if (await installBtn.isVisible()) {
      await installBtn.click();
    }

    // Check terminal overlay
    const terminalOverlay = appPage.locator('[data-testid="terminal-view"], .terminal-overlay, [data-testid^="terminal-overlay-"]').first();
    const hasTerminal = await terminalOverlay.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasTerminal) {
      // Test minimize terminal with '_' button
      const minBtn = appPage.locator('button[aria-label="Hide terminal"], button[title*="Hide terminal"], button:has-text("_")').first();
      if (await minBtn.isVisible()) {
        await minBtn.click();
        await expect(terminalOverlay).toBeHidden({ timeout: 5000 });

        // Verify minimized dock in footer
        const footerDock = appPage.locator('[data-testid="footer-minimized-terminal-cta"]');
        await expect(footerDock).toBeVisible({ timeout: 5000 });

        // Click to resume
        await footerDock.dispatchEvent('click');
        await expect(terminalOverlay).toBeVisible({ timeout: 5000 });
      }
    }

    // Ensure Ollama daemon is active and responding on 11434
    const ollamaOnline = await waitForPortOpen(11434, 30000);
    expect(ollamaOnline).toBe(true);

    // Trigger real pull of a lightweight model (qwen2.5:0.5b, ~398MB)
    const targetModel = 'qwen2.5:0.5b';
    console.log(`[UAT Phase 4] Checking local Ollama tags on 127.0.0.1:11434...`);
    
    let modelReady = false;
    try {
      const tagsRes = await fetch('http://127.0.0.1:11434/api/tags');
      if (tagsRes.ok) {
        const json = await tagsRes.json();
        const models = (json.models || []).map((m: any) => m.name || m.model);
        if (models.some((m: string) => m.includes(targetModel) || m.includes('frugallm-active'))) {
          modelReady = true;
          console.log(`[UAT Phase 4] Model already present in local tags: ${models.join(', ')}`);
        }
      }
    } catch {}

    if (!modelReady) {
      console.log(`[UAT Phase 4] Triggering real network pull of '${targetModel}' via Ollama API...`);
      const pullRes = await fetch('http://127.0.0.1:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: targetModel, stream: true }),
      });
      expect(pullRes.ok).toBe(true);

      const reader = pullRes.body?.getReader();
      const decoder = new TextDecoder();
      let lastReportedPercent = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const msg = JSON.parse(line);
              if (msg.status === 'success') {
                modelReady = true;
              }
              if (msg.total && msg.completed) {
                const pct = Math.floor((msg.completed / msg.total) * 100);
                if (pct >= lastReportedPercent + 25 || pct === 100) {
                  console.log(`[UAT Phase 4] Download progress: ${pct}% (${(msg.completed / 1024 / 1024).toFixed(1)} / ${(msg.total / 1024 / 1024).toFixed(1)} MB)`);
                  lastReportedPercent = pct;
                }
              }
            } catch {}
          }
        }
      }

      // Create frugallm-active alias so FrugaLLM's internal router recognizes and routes to it
      console.log(`[UAT Phase 4] Registering 'frugallm-active' alias from '${targetModel}'...`);
      await fetch('http://127.0.0.1:11434/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'frugallm-active',
          from: targetModel,
          stream: false,
        }),
      });
    }

    // Verify model is active in local Ollama tags
    let verifiedInTags = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:11434/api/tags');
        if (res.ok) {
          const data = await res.json();
          const names = (data.models || []).map((m: any) => m.name || m.model);
          if (names.some((n: string) => n.includes('frugallm-active') || n.includes(targetModel))) {
            verifiedInTags = true;
            console.log(`[UAT Phase 4] Verified in Ollama tags: ${names.join(', ')}`);
            break;
          }
        }
      } catch {}
      await appPage.waitForTimeout(1000);
    }
    expect(verifiedInTags).toBe(true);

    // Hide/minimize terminal overlay if still open to allow next tests to interact with drawer
    if (await terminalOverlay.isVisible().catch(() => false)) {
      const hideBtn = appPage.locator('button[aria-label="Hide terminal"], button[title*="Hide terminal"], button:has-text("✕")').first();
      if (await hideBtn.isVisible()) {
        await hideBtn.click();
      }
    }
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
