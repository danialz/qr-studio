import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages project sites use a /<repository>/ base path.
  base: '/qr-studio/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
