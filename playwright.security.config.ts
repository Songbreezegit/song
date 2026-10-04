import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/security-browser', outputDir: './security-test-results', workers: 1, timeout: 45000,
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'report-only', use: { baseURL: 'http://127.0.0.1:5180' } },
    { name: 'enforced', use: { baseURL: 'http://127.0.0.1:5181' } },
  ],
  webServer: { command: 'node scripts/serve-security-preview.mjs', url: 'http://127.0.0.1:5180', reuseExistingServer: false },
});
