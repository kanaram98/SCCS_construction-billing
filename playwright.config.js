import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests at phone size. They start their own Firebase emulators
 * (firebase.e2e.json, ports 9199/8180) and app (port 5174), so the
 * emulators you develop with are never touched. Needs Java 21.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', ...devices['Pixel 7'], browserName: 'chromium', actionTimeout: 15000, navigationTimeout: 30000 },
  expect: { timeout: 10000 },
  webServer: [
    {
      command: 'npx firebase emulators:start --config firebase.e2e.json --project demo-sccs --only auth,firestore',
      url: 'http://127.0.0.1:8180',
      reuseExistingServer: false,
      timeout: 120000
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort --mode e2e',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 60000
    }
  ]
});
