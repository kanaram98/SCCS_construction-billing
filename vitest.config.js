import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** UI tests: React components rendered in jsdom. Domain tests run with `node --test`. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/ui/**/*.test.jsx'],
    setupFiles: ['tests/ui/setup.js'],
    testTimeout: 20000
  }
});
