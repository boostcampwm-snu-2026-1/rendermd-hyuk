import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // React 17+ automatic JSX runtime so test TSX files don't need
  // `import React from 'react'`. Matches what next.js does at build
  // time. Going through esbuild directly avoids a peer-dep dance with
  // @vitejs/plugin-react, which doesn't have a release that targets
  // Vitest 2's bundled Vite 5.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
