import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run preview --workspace @askrjs/example-spa',
      url: 'http://127.0.0.1:4000',
      reuseExistingServer: false,
    },
    {
      command: 'npm start --workspace @askrjs/example-ssr-only',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: false,
    },
    {
      command: 'npm start --workspace @askrjs/example-api-ssr',
      url: 'http://127.0.0.1:3002/api/health',
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
