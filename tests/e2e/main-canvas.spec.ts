import { test, expect } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';

test.describe('Main Canvas Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri IPC
    await page.addInitScript(() => {
      window.localStorage.setItem('onboardingState', 'completed');
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          invoke: (cmd: string, args: any) => {
            console.log('IPC Invoke:', cmd, args);
            if (cmd === 'check_ollama_status') return Promise.resolve(true);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
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

    // Verify retro nodes are rendered (5 out of 7 are .retro-node, 2 are custom)
    await expect(canvas.nodes).toHaveCount(5);
    
    // Verify specific nodes
    const ollamaNode = await canvas.getNode('OLLAMA LOCAL');
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
    await canvas.dragNode('FRUGALLM CORE', 50, 50);
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/main-canvas.png', fullPage: true });
    await page.screenshot({ path: './copy-audit/node-widgets.png', fullPage: true });
  });

  test('should open configuration panel on node click', async ({ page }) => {
    const canvas = new MainCanvas(page);
    await canvas.goto();

    await canvas.clickNode('FRUGALLM CORE');

    // Verify config panel is open
    const panel = page.getByRole('heading', { name: 'FRUGALLM CORE' });
    await expect(panel).toBeVisible();
    
    const updateButton = page.getByRole('button', { name: 'UPDATE PROTOCOL' });
    await expect(updateButton).toBeVisible();
  });
});
