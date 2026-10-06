import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome']
  },
  webServer: {
    command: 'npm run build && node server/index.js',
    url: 'http://127.0.0.1:8787',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
