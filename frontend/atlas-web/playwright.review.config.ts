import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e', outputDir: process.env.ATLAS_TEST_OUTPUT || 'test-results/review', testMatch: '**/review.spec.ts', timeout: 90_000, fullyParallel: true, workers: 2,
  reporter: [['list'], ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || 'test-results/review.json' }]],
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', colorScheme: 'dark' },
  webServer: { command: 'npx vite preview --outDir dist-review --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
  projects: ['chromium', 'firefox', 'webkit'].map(name => ({ name, use: { ...devices[name === 'chromium' ? 'Desktop Chrome' : name === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'], viewport: { width: 1440, height: 1000 }, ...(name === 'firefox' ? { launchOptions: { firefoxUserPrefs: { 'app.update.disabledForTesting': true, 'app.update.checkInstallTime': false, ...(process.env.ATLAS_CONTAINER_BROWSER === '1' ? { 'media.rdd-process.enabled': false, 'security.sandbox.content.level': 0 } : {}) } } } : {}) } })),
});
