import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // The project lives in a OneDrive folder, where file-change events are
    // sometimes missed; polling keeps the dev server in sync with edits.
    watch: { usePolling: true, interval: 300 }
  }
});
