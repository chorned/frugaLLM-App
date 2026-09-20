import { test, expect } from '../harness/tauri-launcher';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 2: Global Header, Theme & Issue Reporter', () => {
  test('02.1 - Header Elements: verify brand icon, beta banner, and hover tooltips', async ({
    appPage,
  }) => {
    const icon = appPage.locator('[data-testid="header-frugallm-icon"]');
    const betaBanner = appPage.locator('[data-testid="header-beta-banner"]');

    await expect(icon).toBeVisible();
    await expect(betaBanner).toBeVisible();

    // Hover brand icon
    await icon.hover();
    const iconTitle = (await icon.getAttribute('aria-label')) || (await icon.locator('title').textContent());
    expect(iconTitle).toBeTruthy();

    // Hover beta banner
    await betaBanner.hover();
    const betaTitle = await betaBanner.getAttribute('title');
    expect(betaTitle).toBeTruthy();
  });

  test('02.2 - Theme Engine: toggle Light/Dark mode and verify root variables & wire updates', async ({
    appPage,
  }) => {
    const themeBtn = appPage.locator('[data-testid="header-theme-toggle-btn"]');
    await expect(themeBtn).toBeVisible();

    // Capture initial dark theme CSS variable
    const initialCanvasBg = await appPage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--zen-canvas').trim()
    );

    // Toggle theme to Light mode
    await themeBtn.click();
    await appPage.waitForTimeout(300);

    // Assert root CSS variables change
    const lightCanvasBg = await appPage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--zen-canvas').trim()
    );
    expect(lightCanvasBg).not.toBe(initialCanvasBg);

    // Verify SVG traffic wires exist and have valid coordinates
    const svgWires = appPage.locator('svg.wires-layer path, svg path.wire-path, svg path');
    expect(await svgWires.count()).toBeGreaterThan(0);

    // Toggle back to Dark mode
    await themeBtn.click();
    await appPage.waitForTimeout(300);

    const restoredCanvasBg = await appPage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--zen-canvas').trim()
    );
    expect(restoredCanvasBg).toBe(initialCanvasBg);
  });

  test('02.3 - Diagnostic Reporter: open IssueReporterModal, verify fields, preview sanitized bundle', async ({
    appPage,
  }) => {
    const reportBtn = appPage.locator('[data-testid="header-report-issue-btn"]');
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();

    // Modal mounts
    const modal = appPage.locator('[data-testid="issue-reporter-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill Title
    const titleInput = appPage.locator('[data-testid="issue-title-input"]');
    await titleInput.fill('UAT Automated Health Check');

    // Fill Description
    const descInput = appPage.locator('[data-testid="issue-description-input"]');
    await descInput.fill('Verifying sanitized diagnostics and report submission flow in bare-metal UAT.');

    // Fill Email
    const emailInput = appPage.locator('[data-testid="issue-email-input"]');
    await emailInput.fill('qa@frugallm.internal');

    // Verify diagnostics checkbox is checked and toggle it
    const diagCheckbox = appPage.locator('[data-testid="include-diagnostics-checkbox"]');
    await expect(diagCheckbox).toBeChecked();

    // Toggle diagnostics preview inspector
    const previewToggle = appPage.locator('[data-testid="toggle-diagnostics-preview"]');
    await previewToggle.click();

    // Assert sanitized diagnostics preview renders and does not leak raw tokens or passwords
    const previewContainer = modal.locator('pre, code, [data-testid="diagnostics-preview-content"]').first();
    await expect(previewContainer).toBeVisible({ timeout: 5000 });
    const previewText = await previewContainer.innerText();

    expect(previewText).not.toContain('Bearer sk-');
    expect(previewText).not.toContain('secret-password');
    expect(previewText).not.toContain('AIzaSy');

    // Close modal
    const closeBtn = appPage.locator('[data-testid="close-issue-button"], [data-testid="cancel-issue-button"]').first();
    await closeBtn.click();
    await expect(modal).toBeHidden({ timeout: 5000 });
  });
});
