import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `--mode review` builds the staging "design review" variant that bundles the labelled illustrative fixture adapter.
// The production build never includes it (UXJ-28-S03: production cannot import synthetic success handlers).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __ATLAS_REVIEW__: JSON.stringify(mode === 'review'),
    __ATLAS_BUILD__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: 'codemirror', test: /node_modules[\\/](@codemirror|@lezer|crelt|style-mod|w3c-keyname)[\\/]/ },
            { name: 'radix', test: /node_modules[\\/](@radix-ui|cmdk)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
}));
