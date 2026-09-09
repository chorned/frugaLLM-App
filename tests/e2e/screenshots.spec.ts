import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'production_artifacts/screenshots');

test.describe('App Store Homepage Screenshots (1024x768 Native Viewport)', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2, // High-DPI / Retina quality for App Store presentation
    colorScheme: 'dark'
  });

  test('01: Boot Screen with realistic system telemetry checks', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=boot');
    await expect(page.locator('[data-testid="terminal-loader"]')).toBeVisible();
    await expect(page.locator('[data-testid="terminal-loader-console"]')).toBeVisible();
    await expect(page.locator('text=/All neural topology subsystems nominal/i')).toBeVisible();
    
    await page.waitForTimeout(500);
    const destPath = path.join(SCREENSHOTS_DIR, '01_boot_screen.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });

  test('02: Landing Page with all nodes connected and live telemetry', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=landing');
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
    
    // Verify all nodes are rendered and active
    await expect(page.locator('[data-node-id="node-frugallm"]')).toBeVisible();
    await expect(page.locator('[data-node-id="node-ollama"]')).toBeVisible();
    await expect(page.locator('[data-node-id="node-openrouter"]')).toBeVisible();
    await expect(page.locator('[data-node-id="node-google"]')).toBeVisible();
    await expect(page.locator('[data-node-id="node-hermes"]')).toBeVisible();
    await expect(page.locator('[data-node-id="node-opencode"]')).toBeVisible();

    await page.waitForTimeout(800);
    const destPath = path.join(SCREENSHOTS_DIR, '02_landing_page_connected.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });

  test('03: FrugaLLM Hub node with API security and Global Routing Pool', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=node-frugallm');
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-frugallm-port"]')).toBeVisible();
    await expect(page.locator('[data-testid="cloud-routing-panel"]')).toBeVisible();
    
    // Verify top models in the global routing pool
    await expect(page.locator('text=/claude-3.5-sonnet/i').first()).toBeVisible();
    await expect(page.locator('text=/gemini-2.0-flash/i').first()).toBeVisible();

    await page.waitForTimeout(600);
    const destPath = path.join(SCREENSHOTS_DIR, '03_node_frugallm_hub.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });

  test('04: Ollama Local Accelerator node with memory pipeline & tool gateway', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=node-ollama');
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
    await expect(page.locator('text="OLLAMA INSTALLED"')).toBeVisible();
    await expect(page.locator('text="CHAT WITH OLLAMA"')).toBeVisible();
    await expect(page.locator('[data-testid="tool-gateway-status"]')).toBeVisible();

    await page.waitForTimeout(600);
    const destPath = path.join(SCREENSHOTS_DIR, '04_node_ollama_local.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });

  test('05: OpenRouter Cloud Multiplexer node with authenticated tier', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=node-openrouter');
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
    await expect(page.locator('text="OPENROUTER CONNECTED"')).toBeVisible();
    await expect(page.locator('input[name="apiKey"]')).toBeVisible();

    await page.waitForTimeout(600);
    const destPath = path.join(SCREENSHOTS_DIR, '05_node_openrouter_cloud.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });

  test('06: AI Studio Gemini node with high-throughput pipeline', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=node-google');
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
    await expect(page.locator('text="GOOGLE AI STUDIO CONNECTED"')).toBeVisible();
    await expect(page.locator('input[name="googleApiKey"]')).toBeVisible();

    await page.waitForTimeout(600);
    const destPath = path.join(SCREENSHOTS_DIR, '06_node_aistudio_google.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });

  test('07: Hermes Autonomous Agent node with active processes & workspace', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=node-hermes');
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
    await expect(page.locator('text="HERMES AGENT INSTALLED"')).toBeVisible();
    await expect(page.locator('text="LAUNCH HERMES"')).toBeVisible();
    await expect(page.locator('input[name="hermes_workspace"]')).toHaveValue('/Users/alexander/Projects/neural-routing');

    await page.waitForTimeout(600);
    const destPath = path.join(SCREENSHOTS_DIR, '07_node_hermes_agent.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });

  test('08: OpenCode Autonomous Coding Engine node with workspace & tools', async ({ page }) => {
    await page.goto('/?screenshot_mode=true&screen=node-opencode');
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
    await expect(page.locator('text="OPENCODE AGENT INSTALLED"')).toBeVisible();
    await expect(page.locator('text="LAUNCH OPENCODE"')).toBeVisible();
    await expect(page.locator('input[name="opencode_workspace"]')).toHaveValue('/Users/alexander/Workspace/vision-pipeline');

    await page.waitForTimeout(600);
    const destPath = path.join(SCREENSHOTS_DIR, '08_node_opencode_agent.png');
    await page.screenshot({ path: destPath });
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(10000);
  });
});
