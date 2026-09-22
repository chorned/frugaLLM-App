import { test, expect } from '../harness/tauri-launcher';
import { getBuildCredentials } from '../harness/env-loader';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 5: Cloud Providers & Keyring Persistence', () => {
  test('05.1 - Google AI Studio Node: assert link, test key validation probe, verify 200 status', async ({
    appPage,
  }) => {
    test.setTimeout(60_000);
    const { googleKey } = getBuildCredentials();

    const googleCard = appPage.locator('[data-testid="node-google"]');
    await expect(googleCard).toBeVisible({ timeout: 10000 });
    await googleCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // If key is already configured, disconnect it through UI first to return to unconfigured state
    const disconnectGoogleBtn = appPage.locator('[data-testid="disconnect-google-btn"]');
    if (await disconnectGoogleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await disconnectGoogleBtn.scrollIntoViewIfNeeded().catch(() => {});
      await disconnectGoogleBtn.click();
      const confirmYes = appPage.locator('[data-testid="confirm-disconnect-google-btn"]');
      if (await confirmYes.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmYes.click();
      }
      await appPage.waitForTimeout(500);
    }

    // Assert link to Google AI Studio
    const getKeyLink = appPage.locator('[data-testid="link-get-google-key"]');
    await expect(getKeyLink).toBeVisible({ timeout: 5000 });
    await expect(getKeyLink).toHaveAttribute('href', 'https://aistudio.google.com');

    const keyInput = appPage.locator('input[name="googleApiKey"]');
    await expect(keyInput).toBeVisible();

    const testKey = googleKey || 'AIzaSy_UAT_TEST_VALIDATION_DUMMY_KEY_001';
    await keyInput.fill(testKey);

    // Save changes to trigger validation probe
    const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    if (googleKey) {
      console.log('[UAT Phase 5] Probing live Google AI Studio API key and asserting status...');
      // Wait for save operation to complete and connected section to display
      await expect(saveBtn).not.toHaveText(/SAVING/i, { timeout: 25000 });
      await expect(appPage.locator('text=GOOGLE AI STUDIO CONNECTED')).toBeVisible({ timeout: 20000 });
      await expect(appPage.locator('[data-testid="disconnect-google-btn"]')).toBeVisible({ timeout: 5000 });

      // Close drawer and verify status on the node canvas badge reflects upstream response
      const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
      await closeBtn.click();
      await expect(drawer).toBeHidden({ timeout: 5000 });

      const googleStatus = appPage.locator('[data-testid="node-google-status"]');
      await expect(googleStatus).toBeVisible({ timeout: 5000 });
      await expect(googleStatus).toHaveText('200 OK', { timeout: 15000 });
      console.log('[UAT Phase 5] Successfully verified Google AI Studio status in UI');
    } else {
      await appPage.waitForTimeout(1000);
      const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
      await closeBtn.click();
      await expect(drawer).toBeHidden({ timeout: 5000 });
    }
  });

  test('05.2 - OpenRouter Node: assert link, test probe behavior, verify 200 status', async ({
    appPage,
  }) => {
    test.setTimeout(60_000);
    const { openrouterKey } = getBuildCredentials();

    const openrouterCard = appPage.locator('[data-testid="node-openrouter"]');
    await expect(openrouterCard).toBeVisible({ timeout: 10000 });
    await openrouterCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // If key is already configured, disconnect it through UI first to return to unconfigured state
    const disconnectOrBtn = appPage.locator('[data-testid="disconnect-openrouter-btn"]');
    if (await disconnectOrBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await disconnectOrBtn.scrollIntoViewIfNeeded().catch(() => {});
      await disconnectOrBtn.click();
      const confirmYes = appPage.locator('[data-testid="confirm-disconnect-openrouter-btn"]');
      if (await confirmYes.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmYes.click();
      }
      await appPage.waitForTimeout(500);
    }

    // Assert link to OpenRouter
    const getKeyLink = appPage.locator('[data-testid="link-get-openrouter-key"]');
    await expect(getKeyLink).toBeVisible({ timeout: 5000 });
    await expect(getKeyLink).toHaveAttribute('href', 'https://openrouter.ai');

    const keyInput = appPage.locator('input[name="apiKey"]');
    await expect(keyInput).toBeVisible();

    const testKey = openrouterKey || 'sk-or-v1-uat-dummy-openrouter-key-001';
    await keyInput.fill(testKey);

    // Save changes to trigger validation probe
    const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    if (openrouterKey) {
      console.log('[UAT Phase 5] Probing live OpenRouter API key and asserting 200 OK status...');
      // Assert system correctly tests key and reports connected in drawer
      await expect(appPage.locator('text=OPENROUTER CONNECTED')).toBeVisible({ timeout: 15000 });
      await expect(appPage.locator('[data-testid="disconnect-openrouter-btn"]')).toBeVisible({ timeout: 5000 });

      // Close drawer and verify 200 OK status on the node canvas badge
      const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
      await closeBtn.click();
      await expect(drawer).toBeHidden({ timeout: 5000 });

      const openrouterStatus = appPage.locator('[data-testid="node-openrouter-status"]');
      await expect(openrouterStatus).toBeVisible({ timeout: 5000 });
      await expect(openrouterStatus).toHaveText('200 OK', { timeout: 10000 });
      console.log('[UAT Phase 5] Successfully verified OpenRouter 200 OK status in UI');
    } else {
      await appPage.waitForTimeout(1000);
      const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
      await closeBtn.click();
      await expect(drawer).toBeHidden({ timeout: 5000 });
    }
  });
});
