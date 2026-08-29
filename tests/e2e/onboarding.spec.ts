import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';

test.describe('V2 Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri IPC
    await page.addInitScript(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { transformCallback: () => 1234, plugins: { event: { unregisterListener: () => {} } }, transformCallback: () => 1234,
          invoke: (cmd: string, args: any) => {
            if (cmd === 'is_wipe_mode') return Promise.resolve(false);
            if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:e2b');
            return Promise.resolve();
          }
        }
      });
    });
  });

  test('should show decision modal on fresh install and skip tutorial', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Verify modal is visible
    const modalHeading = page.locator('text="Welcome to FrugalLLM"');
    await expect(modalHeading).toBeVisible();

    // Click "Doing is learning"
    await page.locator('button:has-text("Doing is learning")').click();

    // Modal should disappear
    await expect(modalHeading).not.toBeVisible();
    
    // Check localStorage
    const onboardingState = await page.evaluate(() => localStorage.getItem('onboardingState'));
    expect(onboardingState).toBe('completed');
  });

  test('should start interactive tutorial', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Click "I want to learn"
    await page.locator('button:has-text("I want to learn")').click();

    // Tooltip should appear
    const tooltipHeading = page.locator('text="Local Hardware Node"');
    await expect(tooltipHeading).toBeVisible();

    // Check localStorage
    const onboardingState = await page.evaluate(() => localStorage.getItem('onboardingState'));
    expect(onboardingState).toBe('learning');

    // Click "Finish Tour"
    await page.locator('button:has-text("Finish Tour")').click();

    // Tooltip should disappear
    await expect(tooltipHeading).not.toBeVisible();
    
    // Check localStorage
    const finalState = await page.evaluate(() => localStorage.getItem('onboardingState'));
    expect(finalState).toBe('completed');
  });

  test('should clamp tooltip to viewport bounds and punch cutout in spotlight mask', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Start tutorial
    await page.locator('button:has-text("I want to learn")').click();

    // Wait for tooltip card
    const tooltipHeading = page.locator('text="Local Hardware Node"');
    await expect(tooltipHeading).toBeVisible();

    // Assert tooltip container stays strictly within viewport margins
    const tooltipBoundingBox = await tooltipHeading.evaluate((el) => {
      const card = el.closest('div.bg-zen-surface');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };
    });

    expect(tooltipBoundingBox).not.toBeNull();
    if (tooltipBoundingBox) {
      expect(tooltipBoundingBox.left).toBeGreaterThanOrEqual(16);
      expect(tooltipBoundingBox.right).toBeLessThanOrEqual(tooltipBoundingBox.windowWidth - 16);
      expect(tooltipBoundingBox.top).toBeGreaterThanOrEqual(16);
      expect(tooltipBoundingBox.bottom).toBeLessThanOrEqual(tooltipBoundingBox.windowHeight - 16);
    }

    // Verify the 4-quadrant backdrop panels exist surrounding the node
    await expect(page.locator('[data-testid="spotlight-top"]')).toBeVisible();
    await expect(page.locator('[data-testid="spotlight-bottom"]')).toBeVisible();
    await expect(page.locator('[data-testid="spotlight-left"]')).toBeVisible();
    await expect(page.locator('[data-testid="spotlight-right"]')).toBeVisible();
  });
});

