import { test, expect } from '../harness/tauri-launcher';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 6: Autonomous Agents (Hermes & OpenCode)', () => {
  test('06.1 - OpenCode Installation & Process Control: install via UI, verify controls and active process card', async ({
    appPage,
  }) => {
    test.setTimeout(300_000);

    const opencodeCard = appPage.locator('[data-testid="node-opencode"]');
    await expect(opencodeCard).toBeVisible({ timeout: 10000 });
    await opencodeCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Install OpenCode if not already installed on host
    const installBtn = appPage.getByRole('button', { name: 'INSTALL OPENCODE', exact: true });
    if (await installBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('[UAT Phase 6] Clicking INSTALL OPENCODE...');
      await installBtn.click();

      // Assert terminal overlay appears
      const terminalOverlay = appPage.locator('[data-testid="terminal-overlay-install-opencode"]');
      await expect(terminalOverlay).toBeVisible({ timeout: 5000 });

      // Wait for complete installation and auto-exit of terminal runner
      await expect(terminalOverlay).toBeHidden({ timeout: 240000 });
    }

    // Assert drawer transitions to installed state and workspace input unlocks
    const workspaceInput = appPage.locator('input[name="opencode_workspace"]');
    await expect(workspaceInput).toBeVisible({ timeout: 5000 });
    await workspaceInput.fill('~/UAT_OpenCode_Workspace');
    await appPage.waitForTimeout(300);

    const launchOpenCodeBtn = appPage.locator('button:has-text("LAUNCH OPENCODE")');
    const launchWebBtn = appPage.locator('button:has-text("LAUNCH WEBUI")');

    await expect(launchOpenCodeBtn).toBeVisible({ timeout: 10000 });
    await expect(launchOpenCodeBtn).toBeEnabled();
    await expect(launchWebBtn).toBeVisible({ timeout: 5000 });
    await expect(launchWebBtn).toBeEnabled();

    // Test clicking launch trigger and verify active process card mounts with working [CLOSE] button
    console.log('[UAT Phase 6] Launching OpenCode process...');
    await launchOpenCodeBtn.click();

    const activeCard = appPage.locator('[data-testid="active-process-run-opencode"]');
    await expect(activeCard).toBeVisible({ timeout: 10000 });

    const closeProcessBtn = activeCard.locator('button:has-text("CLOSE")');
    await expect(closeProcessBtn).toBeVisible();
    await closeProcessBtn.click();

    // Verify active process card unmounts
    await expect(activeCard).toBeHidden({ timeout: 5000 });

    // Close drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(drawer).toBeHidden({ timeout: 5000 });
  });

  test('06.2 - Hermes Installation & Soul Configuration: install via UI, verify controls, active card, soul editor', async ({
    appPage,
  }) => {
    test.setTimeout(300_000);

    const hermesCard = appPage.locator('[data-testid="node-hermes"]');
    await expect(hermesCard).toBeVisible({ timeout: 10000 });
    await hermesCard.click();

    // Verify drawer open
    const drawer = appPage.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Install Hermes if not already installed on host
    const installBtn = appPage.getByRole('button', { name: 'INSTALL HERMES', exact: true });
    if (await installBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('[UAT Phase 6] Clicking INSTALL HERMES...');
      await installBtn.click();

      // Assert terminal overlay appears
      const terminalOverlay = appPage.locator('[data-testid="terminal-overlay-install-hermes"]');
      await expect(terminalOverlay).toBeVisible({ timeout: 5000 });

      // Wait for complete installation and auto-exit of terminal runner
      await expect(terminalOverlay).toBeHidden({ timeout: 240000 });
    }

    // Assert drawer transitions to installed state and workspace input unlocks
    const workspaceInput = appPage.locator('input[name="hermes_workspace"]');
    await expect(workspaceInput).toBeVisible({ timeout: 5000 });
    await workspaceInput.fill('~/UAT_Hermes_Workspace');
    await appPage.waitForTimeout(300);

    const launchHermesBtn = appPage.locator('button:has-text("LAUNCH HERMES")');
    const launchAppBtn = appPage.locator('button:has-text("LAUNCH APP")');
    const launchWebBtn = appPage.locator('button:has-text("LAUNCH WEBUI")');

    await expect(launchHermesBtn).toBeVisible({ timeout: 10000 });
    await expect(launchHermesBtn).toBeEnabled();
    await expect(launchAppBtn).toBeVisible({ timeout: 5000 });
    await expect(launchAppBtn).toBeEnabled();
    await expect(launchWebBtn).toBeVisible({ timeout: 5000 });
    await expect(launchWebBtn).toBeEnabled();

    // Test clicking launch trigger and verify active process card mounts with working [CLOSE] button
    console.log('[UAT Phase 6] Launching Hermes process...');
    await launchHermesBtn.click();

    const activeCard = appPage.locator('[data-testid="active-process-hermes-cli"]');
    await expect(activeCard).toBeVisible({ timeout: 10000 });

    const closeProcessBtn = activeCard.locator('button:has-text("CLOSE")');
    await expect(closeProcessBtn).toBeVisible();
    await closeProcessBtn.click();

    // Verify active process card unmounts
    await expect(activeCard).toBeHidden({ timeout: 5000 });

    // Assert EDIT SOUL.MD button is present and enabled
    const soulBtn = appPage.locator('button:has-text("EDIT SOUL.MD")');
    await expect(soulBtn).toBeVisible();
    await expect(soulBtn).toBeEnabled();

    // Close drawer
    const closeBtn = appPage.locator('[data-testid="node-config-close-btn"], button:has-text("✕")').first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(drawer).toBeHidden({ timeout: 5000 });
  });
});
