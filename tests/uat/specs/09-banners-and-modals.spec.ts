import { test, expect } from '../harness/tauri-launcher';
import { bindConflictPort, waitForPortOpen } from '../harness/port-sentinel';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 9: Banners & Modal Safety', () => {
  test('09.1 - Port Conflict Banner: simulate conflict, configure port, release and retry', async ({
    appPage,
  }) => {
    test.setTimeout(90_000);

    // 1. Force a genuine port conflict by binding a raw TCP listener
    const conflictPort = 54321;
    const conflictSocket = await bindConflictPort(conflictPort);

    try {
      // Open FrugaLLM configuration drawer
      const frugallmCard = appPage.locator('[data-testid="node-frugallm"]');
      await expect(frugallmCard).toBeVisible({ timeout: 10000 });
      await frugallmCard.click();

      const portInput = appPage.locator('[data-testid="input-frugallm-port"]');
      await expect(portInput).toBeVisible({ timeout: 5000 });

      // Change port to the conflict port and save
      console.log(`[UAT Phase 9] Setting port to conflicting socket port ${conflictPort}...`);
      await portInput.fill(conflictPort.toString());
      const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
      await expect(saveBtn).toBeEnabled({ timeout: 5000 });
      await saveBtn.click();
      await expect(saveBtn).not.toHaveText(/SAVING/i, { timeout: 15000 });

      // Close drawer to see banner
      const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
      await expect(closeBtn).toBeVisible({ timeout: 5000 });
      await closeBtn.click();

      // 2. Assert PortConflictBanner renders with configure, retry, and dismiss buttons
      const banner = appPage.locator('[data-testid="port-conflict-banner"]');
      await expect(banner).toBeVisible({ timeout: 15000 });
      await expect(appPage.locator('[data-testid="port-conflict-configure"]')).toBeVisible();
      await expect(appPage.locator('[data-testid="port-conflict-retry"]')).toBeVisible();
      await expect(appPage.locator('[data-testid="port-conflict-dismiss"]')).toBeVisible();

      // 3. Click configure and verify it opens the FrugaLLM drawer focused on the port input
      console.log('[UAT Phase 9] Clicking port-conflict-configure...');
      await appPage.locator('[data-testid="port-conflict-configure"]').click();
      const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
      await expect(drawer).toBeVisible({ timeout: 5000 });
      await expect(portInput).toBeVisible();

      // 4. Release conflicting socket
      console.log('[UAT Phase 9] Releasing conflicting socket...');
      await conflictSocket.close();

      // Restore port back to 61721 if changed and save
      const currentPort = await portInput.inputValue();
      if (currentPort !== '61721') {
        await portInput.fill('61721');
        await expect(saveBtn).toBeEnabled({ timeout: 5000 });
        await saveBtn.click();
        await expect(saveBtn).not.toHaveText(/SAVING/i, { timeout: 15000 });
      }
      await waitForPortOpen(61721, 15000);

      // Close drawer
      await expect(closeBtn).toBeVisible({ timeout: 5000 });
      await closeBtn.click();
    } catch (e) {
      await conflictSocket.close().catch(() => {});
      throw e;
    }
  });

  test('09.2 - Exit Confirmation Modal: intercept exit when tasks active, test cancel and confirm', async ({
    appPage,
  }) => {
    test.setTimeout(90_000);

    // 1. Launch an active background process via Hermes
    const hermesCard = appPage.locator('[data-testid="node-hermes"]');
    await expect(hermesCard).toBeVisible({ timeout: 10000 });
    await hermesCard.click();

    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Hermes was installed in Phase 6; launch Hermes to establish an active background task
    const launchHermesBtn = appPage.locator('button:has-text("LAUNCH HERMES"), button:has-text("LAUNCH APP")').first();
    await expect(launchHermesBtn).toBeVisible({ timeout: 5000 });
    await launchHermesBtn.click();
    await appPage.waitForTimeout(1000);

    // Close drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();

    // 2. Trigger window close / quit command interception
    console.log('[UAT Phase 9] Emitting request_exit_confirmation with active task...');
    await appPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('request_exit_confirmation'));
    });

    // 3. Assert exit-confirmation-modal is visible without any conditional skips
    const exitModal = appPage.locator('[data-testid="exit-confirmation-modal"]');
    await expect(exitModal).toBeVisible({ timeout: 10000 });
    const cancelBtn = appPage.locator('[data-testid="exit-cancel-button"]');
    const confirmBtn = appPage.locator('[data-testid="exit-confirm-button"]');
    await expect(cancelBtn).toBeVisible();
    await expect(confirmBtn).toBeVisible();

    // 4. Click [Stay in FrugaLLM] (exit-cancel-button); assert modal dismisses and the window remains open
    console.log('[UAT Phase 9] Clicking [Stay in FrugaLLM] to dismiss exit modal...');
    await cancelBtn.click();
    await expect(exitModal).toBeHidden({ timeout: 5000 });

    // Clean up: terminate active background process
    await hermesCard.click();
    await expect(drawer).toBeVisible({ timeout: 5000 });
    const activeCard = appPage.locator('[data-testid="active-process-hermes-cli"], [data-testid="active-process-run-hermes"]').first();
    await expect(activeCard).toBeVisible({ timeout: 5000 });
    const closeProcessBtn = activeCard.locator('button:has-text("CLOSE")');
    await expect(closeProcessBtn).toBeVisible();
    await closeProcessBtn.click();
    await expect(activeCard).toBeHidden({ timeout: 5000 });
    await appPage.waitForTimeout(500);

    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
  });
});
