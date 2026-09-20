import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-uat', open: 'never' }],
  ],
  globalTeardown: path.resolve(__dirname, 'harness/emergency-teardown.ts'),
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    colorScheme: 'dark',
    viewport: { width: 1150, height: 750 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
