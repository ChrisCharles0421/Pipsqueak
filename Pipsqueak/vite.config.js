import { defineConfig } from 'vite';

// Relative base so the build works from any GitHub Pages sub-path (/<repo>/).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
  server: { host: true },
});
