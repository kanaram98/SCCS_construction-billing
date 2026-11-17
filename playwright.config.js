import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the Firebase emulators (start them first with
 * `npm run emulators`). Runs the app on its own port at phone size.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', ...devices['Pixel 7'], browserName: 'chromium', actionTimeout: 15000, navigationTimeout: 30000 },
  expect: { timeout: 10000 },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort --mode development',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 60000
  }
});
