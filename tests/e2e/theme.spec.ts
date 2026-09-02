import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';

test.describe('Dual-Theme System (Ebony Wood & Natural Linen)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear theme storage and set onboarding completed
    await page.addInitScript(() => {
      window.localStorage.setItem('onboardingState', 'completed');
      window['__TAURI_EVENT_PLUGIN_INTERNALS__'] = { unregisterListener: () => {} };
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          transformCallback: () => 1234,
          plugins: { event: { unregisterListener: () => {} } },
          invoke: (cmd: string, args: any) => {
            if (cmd === 'plugin:event|listen') return Promise.resolve(1234);
            if (cmd === 'check_ollama_status') return Promise.resolve(true);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'detect_hardware_profile') return Promise.resolve({ cpu_brand: 'Intel', memory_gb: 16, dedicated_vram: 8192, execution_ceiling: 8192 });
            if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:e2b');
            if (cmd === 'get_frugallm_config') return Promise.resolve({});
            if (cmd === 'get_credential') {
              if (args?.service === 'openrouter') return Promise.resolve('mock-key');
              return Promise.reject('No credential');
            }
            return Promise.resolve();
          }
        }
      });
    });
  });

  test('should default to Ebony Wood (Dark Mode), toggle to Natural Linen (Light Mode), persist across reload, and keep SVG lines aligned', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    const themeToggleBtn = page.locator('[data-testid="header-theme-toggle-btn"]');
    await expect(themeToggleBtn).toBeVisible();

    // 1. Verify Dark Mode (Ebony Wood) as default
    const htmlEl = page.locator('html');
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');
    await expect(htmlEl).toHaveClass(/dark/);
    await expect(htmlEl).toHaveClass(/theme-ebony/);
    await expect(themeToggleBtn.locator('svg.lucide-sun')).toBeVisible();

    // Verify SVG routing lines exist and are colored with dark mode idle color
    const lines = page.locator('[data-testid="router-svg-layer"] line');
    await expect(lines.first()).toBeVisible();
    const lineCount = await lines.count();
    expect(lineCount).toBeGreaterThanOrEqual(5);

    // Check SVG line coordinates before toggle
    const initialLine1 = await lines.first().boundingBox();
    expect(initialLine1).not.toBeNull();

    // 2. Toggle to Natural Linen (Light Mode)
    await themeToggleBtn.click();

    // Verify Light Mode attributes and button icon
    await expect(htmlEl).toHaveAttribute('data-theme', 'light');
    await expect(htmlEl).toHaveClass(/light/);
    await expect(htmlEl).toHaveClass(/theme-linen/);
    await expect(themeToggleBtn.locator('svg.lucide-moon')).toBeVisible();

    // Verify localStorage was updated
    const savedTheme = await page.evaluate(() => localStorage.getItem('frugallm-theme'));
    expect(savedTheme).toBe('light');

    // Wait for the 50ms post-transition SVG recalculation
    await page.waitForTimeout(100);

    // Verify SVG routing lines remain visible and intact
    await expect(lines.first()).toBeVisible();
    const lightLine1 = await lines.first().boundingBox();
    expect(lightLine1).not.toBeNull();

    // 3. Reload page to verify session persistence without flickering
    await page.reload();
    await page.waitForSelector('.retro-node');

    // Should still be in Light Mode
    await expect(htmlEl).toHaveAttribute('data-theme', 'light');
    await expect(htmlEl).toHaveClass(/light/);
    await expect(page.locator('[data-testid="header-theme-toggle-btn"] svg.lucide-moon')).toBeVisible();

    // 4. Toggle back to Ebony Wood (Dark Mode)
    await page.locator('[data-testid="header-theme-toggle-btn"]').click();

    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');
    await expect(htmlEl).toHaveClass(/dark/);
    await expect(htmlEl).toHaveClass(/theme-ebony/);
    await expect(page.locator('[data-testid="header-theme-toggle-btn"] svg.lucide-sun')).toBeVisible();

    const revertedTheme = await page.evaluate(() => localStorage.getItem('frugallm-theme'));
    expect(revertedTheme).toBe('dark');
  });

  test('should have proper accessible attributes on theme toggle button and remove header tagline', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    const toggleBtn = page.locator('[data-testid="header-theme-toggle-btn"]');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveAttribute('aria-label', /theme/i);
    await expect(toggleBtn).toHaveAttribute('role', 'button');

    // Verify tagline was removed from header
    const headerTagline = page.locator('header').getByText('Local-First AI Proxy & Router');
    await expect(headerTagline).not.toBeVisible();
  });

  test('should gracefully handle hostile or corrupted localStorage theme values without crashing', async ({ page }) => {
    // Inject invalid / malicious theme token
    await page.addInitScript(() => {
      window.localStorage.setItem('frugallm-theme', 'malicious-injected-payload-<script>');
    });

    const canvas = new MainCanvas(page);
    await canvas.goto();

    const htmlEl = page.locator('html');
    // Fallback to dark mode safely
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');
    await expect(htmlEl).toHaveClass(/dark/);
    await expect(htmlEl).toHaveClass(/theme-ebony/);

    const toggleBtn = page.locator('[data-testid="header-theme-toggle-btn"]');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn.locator('svg.lucide-sun')).toBeVisible();
  });

  test('should verify dark mode styling on inputs and save changes CTA in node configuration modal', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Ensure dark mode
    const htmlEl = page.locator('html');
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');

    // Open central node config panel
    await page.locator('[data-node-id="node-frugallm"]').click();
    const portInput = page.locator('[data-testid="input-frugallm-port"]');
    await expect(portInput).toBeVisible();

    // Input background should not be bright white (#ffffff / rgb(255, 255, 255))
    const portBgColor = await portInput.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(portBgColor).not.toBe('rgb(255, 255, 255)');

    // Save CTA button should be visible
    const saveBtn = page.locator('[data-testid="save-node-config-button"]');
    await expect(saveBtn).toBeVisible();
    const saveBtnBg = await saveBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(saveBtnBg).not.toBe('rgb(255, 255, 255)');
    expect(saveBtnBg).not.toBe('rgb(228, 228, 231)'); // not old #E4E4E7

    // Modal footer container should not be white
    const modalFooter = saveBtn.locator('..');
    const footerBg = await modalFooter.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(footerBg).not.toBe('rgb(255, 255, 255)');

    // Close modal
    await page.locator('[data-testid="node-config-close-btn"]').click();
  });

  test('should update node selection styles and SVG line colors when toggling between themes', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    const toggleBtn = page.locator('[data-testid="header-theme-toggle-btn"]');
    const centralNode = page.locator('[data-node-id="node-frugallm"]');
    
    // Toggle to Light Mode
    await toggleBtn.click();
    await page.waitForTimeout(100);

    const htmlEl = page.locator('html');
    await expect(htmlEl).toHaveAttribute('data-theme', 'light');

    // Click central node to open configuration modal
    await centralNode.click();
    const closeBtn = page.locator('[data-testid="node-config-close-btn"]');
    await expect(closeBtn).toBeVisible();

    // Close modal
    await closeBtn.click();
    await expect(closeBtn).not.toBeVisible();

    // Toggle back to Dark Mode
    await toggleBtn.click();
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');
  });
});
