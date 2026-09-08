import { defineConfig } from '@playwright/test';

// Explicit local fixtures prevent tests from touching the configured live backend.
const backend = 'http://127.0.0.1:54329';
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
  webServer: [
    { command: 'node tests/fixtures/backend.mjs', url: `${backend}/health`, reuseExistingServer: false },
    {
      command: 'corepack pnpm --filter @addasplit/guest-web exec next dev --hostname 127.0.0.1 --port 3002',
      url: 'http://127.0.0.1:3002', reuseExistingServer: false, timeout: 120_000,
      env: { ADDASPLIT_BROWSER_TEST: '1', NEXT_PUBLIC_SUPABASE_URL: backend, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key' },
    },
    {
      command: 'corepack pnpm --filter @addasplit/host-mobile prepare:ocr && corepack pnpm --filter @addasplit/host-mobile exec expo start --localhost --port 8082 --clear',
      url: 'http://127.0.0.1:8082/status', reuseExistingServer: false, timeout: 120_000,
      env: { CI: '1', BROWSER: 'none', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPABASE_URL: backend,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key', EXPO_PUBLIC_GUEST_URL: 'http://127.0.0.1:3002' },
    },
  ],
});
