import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';

test.describe('Main Canvas Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri IPC
    await page.addInitScript(() => {
      const win = window as Record<string, any>;
      win.localStorage.setItem("onboardingState", "completed");
      win["__TAURI_EVENT_PLUGIN_INTERNALS__"] = { unregisterListener: () => {} };
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { transformCallback: () => 1234, plugins: { event: { unregisterListener: () => {} } },
          invoke: (cmd: string, args: any) => {
            console.log('IPC Invoke:', cmd, args);
            if (cmd === 'plugin:event|listen') return Promise.resolve(1234);
            if (cmd === 'check_ollama_status') return Promise.resolve(true);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
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

  test('should render canvas, nodes, and prevent panning/zooming', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Verify canvas exists
    await expect(canvas.canvas).toBeVisible();

    // Verify nodes are rendered (6 nodes total)
    await expect(canvas.nodes).toHaveCount(6);
    
    // Verify specific nodes
    const ollamaNode = await canvas.getNode('Ollama');
    await expect(ollamaNode).toBeVisible();
    
    // Node status should be updated by mock (Ollama should be STANDBY/CONNECTED initially)
    // Wait, the status is STANDBY or CONNECTED based on active.
    // In App.tsx, initial Ollama status is needs_activation. 
    // It gets updated via IPC, but actually it is updated via telemetry_update event for active.
    
    // Test zooming
    const transformBefore = await canvas.page.locator('div[style*="transform: scale"]').first().getAttribute('style');
    await canvas.zoomCanvas(-500); // attempt zoom in
    
    await expect(async () => {
      const transformAfter = await canvas.page.locator('div[style*="transform: scale"]').first().getAttribute('style');
      expect(transformAfter).toEqual(transformBefore); // Should not change
    }).toPass();

    // Test panning
    await canvas.panCanvas(100, 100);
    
    await expect(async () => {
      const transformPan = await canvas.page.locator('div[style*="transform: scale"]').first().getAttribute('style');
      expect(transformPan).toEqual(transformBefore); // Should not change
    }).toPass();

    // Test drag node (even if it doesn't move it in v1, we simulate it)
    await canvas.dragNode('FrugaLLM', 50, 50);
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/main-canvas.png', fullPage: true });
    await page.screenshot({ path: './copy-audit/node-widgets.png', fullPage: true });
  });

  test('should open configuration panel on node click', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Click FrugalLM node to open panel
    await canvas.clickNode('FrugaLLM');

    // Verify config panel is open
    const panel = page.getByRole('heading', { name: /FrugaLLM/i });
    await expect(panel).toBeVisible();
    
    const updateButton = page.getByRole('button', { name: /SAVE CHANGES/i });
    await expect(updateButton).toBeVisible();
  });

  test('should render session tokens, lifetime tokens, and money saved on FrugaLLM node', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    const sessionTokens = page.getByTestId('frugallm-session-tokens');
    const totalTokens = page.getByTestId('frugallm-total-tokens');
    const moneySaved = page.getByTestId('frugallm-money-saved');

    await expect(sessionTokens).toBeVisible();
    await expect(totalTokens).toBeVisible();
    await expect(moneySaved).toBeVisible();
  });

  test('should have default cursor on background canvas and prevent overscroll bounce', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    await expect(canvas.canvas).toBeVisible();

    // Verify canvas background has default cursor (not grab or grabbing)
    const cursor = await canvas.canvas.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(cursor).toBe('default');

    // Verify body / html overscroll-behavior is none
    const bodyOverscroll = await page.evaluate(() => window.getComputedStyle(document.body).overscrollBehavior);
    expect(bodyOverscroll).toBe('none');

    const htmlOverscroll = await page.evaluate(() => window.getComputedStyle(document.documentElement).overscrollBehavior);
    expect(htmlOverscroll).toBe('none');

    // Verify html background color is explicitly set to dark
    const htmlBg = await page.evaluate(() => window.getComputedStyle(document.documentElement).backgroundColor);
    expect(htmlBg).toBe('rgb(17, 24, 39)'); // #111827
  });
});
