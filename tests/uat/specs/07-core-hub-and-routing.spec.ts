import { test, expect } from '../harness/tauri-launcher';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 7: Core Hub & Global Routing Pool', () => {
  test('07.1 - Core Proxy Settings: port change, bind interfaces, copy IP & port', async ({
    appPage,
  }) => {
    const frugallmCard = appPage.locator('[data-testid="node-frugallm"]');
    await expect(frugallmCard).toBeVisible({ timeout: 10000 });
    await frugallmCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Port input test
    const portInput = appPage.locator('[data-testid="input-frugallm-port"]');
    await expect(portInput).toBeVisible();
    const initialPort = await portInput.inputValue();

    // Change port to 8081 then back
    await portInput.fill('8081');
    await appPage.waitForTimeout(200);
    await portInput.fill(initialPort || '61721');

    // Toggle bind all interfaces checkbox
    const bindAllCheckbox = appPage.locator('input[name="bind_all_interfaces"]');
    if (await bindAllCheckbox.isVisible()) {
      await bindAllCheckbox.click();
      await appPage.waitForTimeout(200);
      await bindAllCheckbox.click(); // revert
    }

    // Click COPY IP & PORT button
    const copyIpPortBtn = appPage.locator('[data-testid="btn-copy-ip-port"]');
    await expect(copyIpPortBtn).toBeVisible();
    await copyIpPortBtn.click();
    await appPage.waitForTimeout(300);
  });

  test('07.2 - API Password: toggle checkbox, input password, mask toggle, copy password', async ({
    appPage,
  }) => {
    // API password toggle checkbox
    const passCheckbox = appPage.locator('[data-testid="api-password-checkbox"]');
    if (await passCheckbox.isVisible()) {
      const isChecked = await passCheckbox.isChecked();
      if (!isChecked) {
        await passCheckbox.click();
      }

      const passInput = appPage.locator('[data-testid="api-password-input"]');
      await expect(passInput).toBeVisible({ timeout: 3000 });
      await passInput.fill('uat-super-secret-password-123');

      // Toggle mask (Eye / EyeOff)
      const toggleVisBtn = appPage.locator('[data-testid="toggle-password-visibility"]');
      await expect(toggleVisBtn).toBeVisible();
      await toggleVisBtn.click();
      expect(await passInput.getAttribute('type')).toBe('text');

      await toggleVisBtn.click();
      expect(await passInput.getAttribute('type')).toBe('password');

      // Copy password button
      const copyPassBtn = appPage.locator('[data-testid="copy-password-button"]');
      await expect(copyPassBtn).toBeVisible();
      await copyPassBtn.click();
    }
  });

  test('07.3 - System Settings & Logs: toggle system settings and trigger view logs', async ({
    appPage,
  }) => {
    // Checkboxes in settings panel
    const startOnLogin = appPage.locator('[data-testid="checkbox-start-on-login"]');
    if (await startOnLogin.isVisible()) {
      await startOnLogin.click();
      await startOnLogin.click();
    }

    const startMinimized = appPage.locator('[data-testid="checkbox-start-minimized"]');
    if (await startMinimized.isVisible()) {
      await startMinimized.click();
      await startMinimized.click();
    }

    const globalCli = appPage.locator('[data-testid="checkbox-global-cli"]');
    if (await globalCli.isVisible()) {
      await globalCli.click();
      await globalCli.click();
    }

    // View logs button
    const viewLogsBtn = appPage.locator('[data-testid="btn-view-logs"]');
    if (await viewLogsBtn.isVisible()) {
      await viewLogsBtn.click();
    }
  });

  test('07.4 - Global Routing Pool: refresh roster, reorder models, pin and unpin', async ({
    appPage,
  }) => {
    // REFRESH routing pool button
    const refreshBtn = appPage.locator('button:has-text("REFRESH"), button:has-text("Refresh")').first();
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await appPage.waitForTimeout(500);
    }

    // Move model down and up using Chevron buttons
    const chevronDown = appPage.locator('button[title*="Down"], button:has(svg.lucide-chevron-down)').first();
    if (await chevronDown.isVisible()) {
      await chevronDown.click();
      await appPage.waitForTimeout(200);
    }

    const chevronUp = appPage.locator('button[title*="Up"], button:has(svg.lucide-chevron-up)').first();
    if (await chevronUp.isVisible()) {
      await chevronUp.click();
      await appPage.waitForTimeout(200);
    }

    // Pin model to top
    const pinBtn = appPage.locator('button[title*="Top"], button:has(svg.lucide-arrow-up-to-line)').first();
    if (await pinBtn.isVisible()) {
      await pinBtn.click();
      await appPage.waitForTimeout(200);
    }

    // Close config drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });
});
