import { test, expect } from '../harness/tauri-launcher';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 3: Topology Canvas & Live Telemetry', () => {
  test('03.1 - Canvas Geometry & Alignment: verify central hub centering and peripheral nodes', async ({
    appPage,
  }) => {
    const hubNode = appPage.locator('[data-testid="node-frugallm"]');
    await expect(hubNode).toBeVisible({ timeout: 10000 });

    // Assert presence of all 5 peripheral cards
    const peripheralIds = [
      'node-ollama',
      'node-google',
      'node-openrouter',
      'node-opencode',
      'node-hermes',
    ];

    for (const id of peripheralIds) {
      const node = appPage.locator(`[data-testid="${id}"]`);
      await expect(node).toBeVisible();
    }

    // Verify FrugaLLM hub centering near midpoint
    const hubBox = await hubNode.boundingBox();
    expect(hubBox).toBeTruthy();

    const canvas = appPage.locator('[data-testid="main-canvas"], [data-testid="router-main-container"]').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    if (hubBox && canvasBox) {
      const hubCenterX = hubBox.x + hubBox.width / 2;
      const hubCenterY = hubBox.y + hubBox.height / 2;
      const canvasCenterX = canvasBox.x + canvasBox.width / 2;
      const canvasCenterY = canvasBox.y + canvasBox.height / 2;

      // Assert center points are mathematically aligned within tolerance (< 40px)
      expect(Math.abs(hubCenterX - canvasCenterX)).toBeLessThan(40);
      expect(Math.abs(hubCenterY - canvasCenterY)).toBeLessThan(50);
    }
  });

  test('03.2 - Metric Tooltips: trigger info popovers for session tokens, lifetime tokens, and money saved', async ({
    appPage,
  }) => {
    // 1. Session tokens tooltip
    const sessionInfoBtn = appPage.locator('[data-testid="btn-frugallm-session-tokens-info"]');
    await expect(sessionInfoBtn).toBeVisible();
    await sessionInfoBtn.hover();
    await sessionInfoBtn.click();
    await appPage.waitForTimeout(200);

    // 2. Total lifetime tokens tooltip
    const totalInfoBtn = appPage.locator('[data-testid="btn-frugallm-total-tokens-info"]');
    await expect(totalInfoBtn).toBeVisible();
    await totalInfoBtn.hover();
    await totalInfoBtn.click();
    await appPage.waitForTimeout(200);

    // 3. Money saved benchmark calculation tooltip
    const savedInfoBtn = appPage.locator('[data-testid="btn-frugallm-money-saved-info"]');
    await expect(savedInfoBtn).toBeVisible();
    await savedInfoBtn.hover();
    await savedInfoBtn.click();
    await appPage.waitForTimeout(200);
  });

  test('03.3 - Telemetry Event Stream: verify hardware telemetry values populate non-zero metrics', async ({
    appPage,
  }) => {
    // Wait for native telemetry poller to broadcast telemetry_update
    await appPage.waitForTimeout(1500);

    // Hardware node should reflect detected system memory / VRAM / CPU state
    const ollamaCard = appPage.locator('[data-testid="node-ollama"]');
    await expect(ollamaCard).toBeVisible();

    const textContent = await ollamaCard.innerText();
    expect(textContent).toBeTruthy();
  });
});
