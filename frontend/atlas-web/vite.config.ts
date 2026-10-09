import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `vite preview` serves the same security headers as production (public/_headers) so e2e catches CSP violations.
const securityHeaders = Object.fromEntries(readFileSync('public/_headers', 'utf8').split('\n/assets/*')[0].split('\n')
  .filter((l) => /^\s+\S+:/.test(l)).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));

// Local routing mirrors the two independently hosted entry documents. No shared SPA/router/session.
const observerEntry = () => {
  const rewrite = (server: { middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, _res, next) => { if (/^\/observer(?:\/|\?|$)/.test(req.url || '')) req.url = '/telemetry-console.html' + ((req.url || '').includes('?') ? '?' + (req.url || '').split('?')[1] : ''); next(); });
  };
  return { name: 'observer-entry', configureServer: rewrite, configurePreviewServer: rewrite };
};

// `--mode review` builds the staging "design review" variant that bundles the labelled illustrative fixture adapter.
// The production build never includes it (UXJ-28-S03: production cannot import synthetic success handlers).
export default defineConfig(({ mode }) => ({
  plugins: [react(), observerEntry()],
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
      input: { workspace: resolve('index.html'), observer: resolve('telemetry-console.html') },
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
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
