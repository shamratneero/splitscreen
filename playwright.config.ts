import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8082',
    viewport: { width: 390, height: 844 },
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  },
  webServer: {
    command: 'corepack pnpm --filter @addasplit/host-mobile exec expo start --localhost --port 8082 --clear',
    url: 'http://127.0.0.1:8082/status',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CI: '1', BROWSER: 'none' },
  },
});
