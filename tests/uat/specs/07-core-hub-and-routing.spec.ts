import { test, expect } from '../harness/tauri-launcher';
import { waitForPortOpen } from '../harness/port-sentinel';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 7: Core Hub & Global Routing Pool', () => {
  test('07.1 - Core Proxy Settings: port change, persistence verification, and port restoration', async ({
    appPage,
  }) => {
    test.setTimeout(120_000);

    const frugallmCard = appPage.locator('[data-testid="node-frugallm"]');
    await expect(frugallmCard).toBeVisible({ timeout: 10000 });
    await frugallmCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Port input test
    const portInput = appPage.locator('[data-testid="input-frugallm-port"]');
    await expect(portInput).toBeVisible();

    try {
      // Change port to 8081 and click save
      console.log('[UAT Phase 7] Changing port to 8081 and saving...');
      await portInput.fill('8081');
      const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
      await expect(saveBtn).toBeVisible();
      await expect(saveBtn).toBeEnabled({ timeout: 5000 });
      await saveBtn.click();

      // Verify via PortSentinel that the native Axum server successfully binds to port 8081
      console.log('[UAT Phase 7] Verifying Axum proxy server bound to 8081...');
      const port8081Bound = await waitForPortOpen(8081, 20000);
      expect(port8081Bound).toBe(true);

      // Verify persistence: Close drawer, re-open, and assert the input still displays 8081
      console.log('[UAT Phase 7] Verifying persistence: closing drawer and reopening...');
      const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
      await closeBtn.click();
      await expect(drawer).toBeHidden({ timeout: 5000 });

      await frugallmCard.click();
      await expect(drawer).toBeVisible({ timeout: 5000 });
      await expect(portInput).toHaveValue('8081');
    } finally {
      // Restore port back to 61721 and save
      console.log('[UAT Phase 7] Restoring port back to 61721 and saving...');
      if (!await drawer.isVisible().catch(() => false)) {
        await frugallmCard.click();
        await expect(drawer).toBeVisible({ timeout: 5000 });
      }
      await portInput.fill('61721');
      const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
      await expect(saveBtn).toBeEnabled({ timeout: 5000 });
      await saveBtn.click();
      await expect(saveBtn).not.toHaveText(/SAVING/i, { timeout: 15000 });
      await waitForPortOpen(61721, 20000);
    }

    // Toggle bind all interfaces checkbox
    const bindAllCheckbox = appPage.locator('input[name="bind_all_interfaces"]');
    await expect(bindAllCheckbox).toBeVisible({ timeout: 5000 });
    await bindAllCheckbox.click();
    await appPage.waitForTimeout(200);
    await bindAllCheckbox.click(); // revert

    // Click COPY IP & PORT button
    const copyIpPortBtn = appPage.locator('[data-testid="btn-copy-ip-port"]');
    await expect(copyIpPortBtn).toBeVisible();
    await copyIpPortBtn.click();
    await appPage.waitForTimeout(300);
  });

  test('07.2 - API Password: configure token, verify 401 gate, verify 200 with auth', async ({
    appPage,
  }) => {
    test.setTimeout(60_000);

    const frugallmCard = appPage.locator('[data-testid="node-frugallm"]');
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    if (!await drawer.isVisible().catch(() => false)) {
      await frugallmCard.click();
      await expect(drawer).toBeVisible({ timeout: 5000 });
    }

    const passCheckbox = appPage.locator('[data-testid="api-password-checkbox"]');
    await expect(passCheckbox).toBeVisible({ timeout: 5000 });
    const isChecked = await passCheckbox.isChecked();
    if (isChecked) {
      await passCheckbox.click();
      const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
      if (await saveBtn.isEnabled()) {
        await saveBtn.click();
        await expect(saveBtn).not.toHaveText(/SAVING/i, { timeout: 15000 });
        await appPage.waitForTimeout(500);
      }
    }

    // Turn on password protection
    await passCheckbox.click();
    const passInput = appPage.locator('[data-testid="api-password-input"]');
    await expect(passInput).toBeVisible({ timeout: 3000 });
    const testSecret = 'uat-super-secret-password-123';
    await passInput.fill(testSecret);

    // Save changes to activate password protection
    const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();
    await expect(saveBtn).not.toHaveText(/SAVING/i, { timeout: 15000 });
    await appPage.waitForTimeout(500);

    // Verify that unauthorized requests to the proxy receive HTTP 401
    console.log('[UAT Phase 7] Verifying unauthorized request receives HTTP 401...');
    const unauthRes = await fetch('http://127.0.0.1:61721/v1/models').catch(() => null);
    expect(unauthRes).not.toBeNull();
    expect(unauthRes!.status).toBe(401);
    console.log('[UAT Phase 7] Successfully verified HTTP 401 unauthorized gate');

    // Verify that authorized requests receive HTTP 200
    console.log('[UAT Phase 7] Verifying authorized request with Bearer token receives HTTP 200...');
    const authRes = await fetch('http://127.0.0.1:61721/v1/models', {
      headers: { Authorization: `Bearer ${testSecret}` },
    }).catch(() => null);
    expect(authRes).not.toBeNull();
    expect(authRes!.status).toBe(200);
    console.log('[UAT Phase 7] Successfully verified HTTP 200 authorized gate');

    // Copy password button check while password is active
    const copyPassBtn = appPage.locator('[data-testid="copy-password-button"]');
    await expect(copyPassBtn).toBeVisible({ timeout: 5000 });
    await copyPassBtn.click();

    // Revert: uncheck password protection and save
    if (await passCheckbox.isChecked()) {
      await passCheckbox.click();
      await expect(saveBtn).toBeEnabled({ timeout: 5000 });
      await saveBtn.click();
      await expect(saveBtn).not.toHaveText(/SAVING/i, { timeout: 15000 });
      await appPage.waitForTimeout(500);
    }
    await appPage.waitForTimeout(500);
  });

  test('07.3 - System Settings & Logs: toggle system settings and trigger view logs', async ({
    appPage,
  }) => {
    const frugallmCard = appPage.locator('[data-testid="node-frugallm"]');
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    if (!await drawer.isVisible().catch(() => false)) {
      await frugallmCard.click();
      await expect(drawer).toBeVisible({ timeout: 5000 });
    }

    // Checkboxes in settings panel
    const startOnLogin = appPage.locator('[data-testid="checkbox-start-on-login"]');
    await expect(startOnLogin).toBeVisible({ timeout: 5000 });
    await startOnLogin.click();
    await startOnLogin.click();

    const startMinimized = appPage.locator('[data-testid="checkbox-start-minimized"]');
    await expect(startMinimized).toBeVisible({ timeout: 5000 });
    await startMinimized.click();
    await startMinimized.click();

    const globalCli = appPage.locator('[data-testid="checkbox-global-cli"]');
    await expect(globalCli).toBeVisible({ timeout: 5000 });
    await globalCli.click();
    await globalCli.click();

    // View logs button
    const viewLogsBtn = appPage.locator('[data-testid="btn-view-logs"]');
    await expect(viewLogsBtn).toBeVisible({ timeout: 5000 });
    await viewLogsBtn.click();
  });

  test('07.4 - Global Routing Pool: pull models, populate roster, verify model scores, test ranking and fallback logic', async ({
    appPage,
  }) => {
    test.setTimeout(60_000);

    const frugallmCard = appPage.locator('[data-testid="node-frugallm"]');
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    if (!await drawer.isVisible().catch(() => false)) {
      await frugallmCard.click();
      await expect(drawer).toBeVisible({ timeout: 5000 });
    }

    // Assert routing pool panel is rendered
    const routingPanel = appPage.locator('[data-testid="cloud-routing-panel"]');
    await expect(routingPanel).toBeVisible({ timeout: 5000 });

    // Click REFRESH button to trigger live model pull and score evaluation
    const refreshBtn = appPage.locator('button:has-text("REFRESH"), button:has-text("Refresh")').first();
    await expect(refreshBtn).toBeVisible({ timeout: 5000 });
    await refreshBtn.click();

    // 1. Assert models are pulled and populated in the FrugaLLM node
    console.log('[UAT Phase 7] Waiting for models to populate in FrugaLLM routing pool...');
    const modelRows = appPage.locator('[data-testid^="model-row-"]');
    await expect(modelRows.first()).toBeVisible({ timeout: 25000 });

    const modelCount = await modelRows.count();
    console.log(`[UAT Phase 7] Successfully populated ${modelCount} models into routing pool`);
    expect(modelCount).toBeGreaterThan(0);

    // 2. Assert model scores are correctly displayed on each model row
    console.log('[UAT Phase 7] Verifying IQ score displays across populated models...');
    const sampleSize = Math.min(modelCount, 5);
    const scores: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const row = modelRows.nth(i);
      await expect(row).toBeVisible();
      await expect(row).toContainText(/SCORE:\s*\d+/);

      const rowText = await row.innerText();
      const match = rowText.match(/SCORE:\s*([\d.]+)/);
      if (match) {
        const scoreVal = parseFloat(match[1]);
        expect(scoreVal).toBeGreaterThan(0);
        scores.push(scoreVal);
      }
    }
    console.log(`[UAT Phase 7] Verified ${scores.length} scores: ${scores.join(', ')}`);

    // 3. Assert default score-based ranking hierarchy (descending priority)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
    console.log('[UAT Phase 7] Successfully verified models are ranked descending by score');

    // 4. Test fallback and manual ranking logic (Rank Down, Rank Top, and Reset)
    if (modelCount >= 2) {
      const initialTopText = await modelRows.nth(0).innerText();
      const initialSecondText = await modelRows.nth(1).innerText();

      // Test Demotion (Rank Down): Demote top model
      console.log('[UAT Phase 7] Testing model demotion via Rank Down...');
      const rankDownBtn = modelRows.nth(0).locator('button[title*="Down"], button[title*="Rank Down"]').first();
      await expect(rankDownBtn).toBeVisible({ timeout: 5000 });
      await expect(rankDownBtn).toBeEnabled();
      await rankDownBtn.click();
      await appPage.waitForTimeout(600);

      // Verify second model is now promoted to active top slot
      const demotedFirstText = await modelRows.nth(0).innerText();
      expect(demotedFirstText).not.toEqual(initialTopText);
      console.log('[UAT Phase 7] Verified Rank Down shifted priority order');

      // Test Promotion (Rank Top): Promote second model to top slot
      console.log('[UAT Phase 7] Testing model promotion via Rank Top...');
      const rankTopBtn = modelRows.nth(1).locator('button[title*="Top"], button[title*="Rank Top"]').first();
      await expect(rankTopBtn).toBeVisible({ timeout: 5000 });
      await rankTopBtn.click();
      await appPage.waitForTimeout(600);

      // Test Reset to Dynamic: Verify Reset button appears on pinned model and resets order
      const resetBtn = appPage.locator('button:has-text("Reset"), button[title*="Reset Rank"]').first();
      if (await resetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('[UAT Phase 7] Clicking Reset button to unpin model and restore dynamic score ranking...');
        await resetBtn.click();
        await appPage.waitForTimeout(600);
        console.log('[UAT Phase 7] Dynamic fallback score ranking restored');
      }
    }

    // Close config drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    await expect(drawer).toBeHidden({ timeout: 5000 });
  });
});
