import { defineConfig } from 'vitest/config';

/**
 * Security-rules tests against the Firestore emulator.
 * Run with `npm run test:rules` (starts the emulator; needs Java 21).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false
  }
});
