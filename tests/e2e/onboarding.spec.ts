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
});
