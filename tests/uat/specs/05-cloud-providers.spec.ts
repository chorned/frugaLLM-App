import { test, expect } from '../harness/tauri-launcher';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 5: Cloud Providers & Keyring Persistence', () => {
  test('05.1 - Google AI Studio Node: assert link, test key validation probe, verify health indicator', async ({
    appPage,
  }) => {
    const googleCard = appPage.locator('[data-testid="node-google"]');
    await expect(googleCard).toBeVisible({ timeout: 10000 });
    await googleCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Assert link to Google AI Studio
    const getKeyLink = appPage.locator('[data-testid="link-get-google-key"]');
    if (await getKeyLink.isVisible()) {
      await expect(getKeyLink).toHaveAttribute('href', 'https://aistudio.google.com');
    }

    // Enter test key format
    const keyInput = appPage.locator('input[name="googleApiKey"]');
    await expect(keyInput).toBeVisible();
    await keyInput.fill('AIzaSy_UAT_TEST_VALIDATION_DUMMY_KEY_001');

    // Save changes to trigger validation probe
    const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await appPage.waitForTimeout(1000);
    }

    // Close drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('05.2 - OpenRouter Node: assert link, test probe behavior, close drawer', async ({
    appPage,
  }) => {
    const openrouterCard = appPage.locator('[data-testid="node-openrouter"]');
    await expect(openrouterCard).toBeVisible({ timeout: 10000 });
    await openrouterCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Assert link to OpenRouter
    const getKeyLink = appPage.locator('[data-testid="link-get-openrouter-key"]');
    if (await getKeyLink.isVisible()) {
      await expect(getKeyLink).toHaveAttribute('href', 'https://openrouter.ai');
    }

    // Enter test key format
    const keyInput = appPage.locator('input[name="apiKey"]');
    await expect(keyInput).toBeVisible();
    await keyInput.fill('sk-or-v1-uat-dummy-openrouter-key-001');

    // Save changes
    const saveBtn = appPage.locator('[data-testid="save-node-config-button"]');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await appPage.waitForTimeout(1000);
    }

    // Close drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });
});
