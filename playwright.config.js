import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests at phone size. Two setups:
 *  - "cloud": the app wired to its own Firebase emulators (firebase.e2e.json,
 *    ports 9199/8180), with the app on port 5174: sign-in, roles, sync.
 *  - "plain": the app without cloud (port 5175): every screen, exports.
 * Your own development emulators are never touched. Needs Java 21.
 */
const phone = { ...devices['Pixel 7'], browserName: 'chromium', actionTimeout: 15000, navigationTimeout: 30000 };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  workers: 1,
  expect: { timeout: 20000 },
  projects: [
    { name: 'cloud', testMatch: /(cloud-sync|signed-out-local)\.spec\.js/, use: { ...phone, baseURL: 'http://127.0.0.1:5174' } },
    { name: 'plain', testMatch: /plain-.*\.spec\.js/, use: { ...phone, baseURL: 'http://127.0.0.1:5175', acceptDownloads: true } }
  ],
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
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5175 --strictPort --mode plain',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
      timeout: 60000
    }
  ]
});
