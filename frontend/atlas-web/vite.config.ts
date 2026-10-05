import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// `vite preview` serves the same security headers as production (public/_headers) so e2e catches CSP violations.
const securityHeaders = Object.fromEntries(readFileSync('public/_headers', 'utf8').split('\n/assets/*')[0].split('\n')
  .filter((l) => /^\s+\S+:/.test(l)).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));

// `--mode review` builds the staging "design review" variant that bundles the labelled illustrative fixture adapter.
// The production build never includes it (UXJ-28-S03: production cannot import synthetic success handlers).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __ATLAS_REVIEW__: JSON.stringify(mode === 'review'),
    // Reproducible: the build id is the source commit (set by tools/release.mjs / CI), never the wall clock.
    __ATLAS_BUILD__: JSON.stringify(process.env.ATLAS_BUILD_ID || 'local'),
  },
  preview: { headers: securityHeaders },
  build: {
    target: 'es2022',
    sourcemap: false,
    // No data: URIs (small fonts would otherwise be inlined and blocked by CSP font-src 'self').
    assetsInlineLimit: 0,
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
