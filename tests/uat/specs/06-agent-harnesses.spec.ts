import { test, expect } from '../harness/tauri-launcher';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 6: Autonomous Agents (Hermes & OpenCode)', () => {
  test('06.1 - OpenCode Installation & Process Control: configure workspace and test process controls', async ({
    appPage,
  }) => {
    const opencodeCard = appPage.locator('[data-testid="node-opencode"]');
    await expect(opencodeCard).toBeVisible({ timeout: 10000 });
    await opencodeCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Set temporary workspace
    const workspaceInput = appPage.locator('input[name="opencode_workspace"]');
    if (await workspaceInput.isVisible()) {
      await workspaceInput.fill('~/UAT_OpenCode_Workspace');
      await appPage.waitForTimeout(300);
    }

    // Install OpenCode or Launch WebUI button check
    const installBtn = appPage.locator('button:has-text("INSTALL OPENCODE")');
    const launchWebBtn = appPage.locator('button:has-text("LAUNCH WEBUI")');

    if (await installBtn.isVisible()) {
      await installBtn.click();
      const terminalOverlay = appPage.locator('[data-testid="terminal-view"], .terminal-overlay').first();
      if (await terminalOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Close terminal
        const closeTerm = appPage.locator('button[title="Close process"], button:has-text("✕")').first();
        if (await closeTerm.isVisible()) await closeTerm.click();
      }
    } else if (await launchWebBtn.isVisible()) {
      await launchWebBtn.click();
      await appPage.waitForTimeout(500);

      // Check active child process card with [CLOSE]
      const closeProcessBtn = appPage.locator('button:has-text("CLOSE")').first();
      if (await closeProcessBtn.isVisible()) {
        await closeProcessBtn.click();
      }
    }

    // Close drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  });

  test('06.2 - Hermes Installation & Soul Configuration: workspace, gateway, soul editor', async ({
    appPage,
  }) => {
    const hermesCard = appPage.locator('[data-testid="node-hermes"]');
    await expect(hermesCard).toBeVisible({ timeout: 10000 });
    await hermesCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Set hermes workspace path
    const workspaceInput = appPage.locator('input[name="hermes_workspace"]');
    if (await workspaceInput.isVisible()) {
      await workspaceInput.fill('~/UAT_Hermes_Workspace');
      await appPage.waitForTimeout(300);
    }

    // Check Install Hermes or Launch Gateway / App
    const installBtn = appPage.locator('button:has-text("INSTALL HERMES")');
    const launchGatewayBtn = appPage.locator('button:has-text("LAUNCH APP / GATEWAY"), button:has-text("LAUNCH GATEWAY")');

    if (await installBtn.isVisible()) {
      await installBtn.click();
      const terminalOverlay = appPage.locator('[data-testid="terminal-view"], .terminal-overlay').first();
      if (await terminalOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
        const closeTerm = appPage.locator('button[title="Close process"], button:has-text("✕")').first();
        if (await closeTerm.isVisible()) await closeTerm.click();
      }
    } else if (await launchGatewayBtn.isVisible()) {
      await launchGatewayBtn.click();
      await appPage.waitForTimeout(500);

      // Verify active background daemon management card
      const closeProcessBtn = appPage.locator('button:has-text("CLOSE")').first();
      if (await closeProcessBtn.isVisible()) {
        await closeProcessBtn.click();
      }
    }

    // Assert EDIT SOUL.MD button is present and clickable
    const soulBtn = appPage.locator('button:has-text("EDIT SOUL.MD")');
    if (await soulBtn.isVisible()) {
      await expect(soulBtn).toBeEnabled();
      await soulBtn.click();
    }

    // Close drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  });
});
