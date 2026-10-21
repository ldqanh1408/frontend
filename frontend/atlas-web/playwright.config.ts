import { defineConfig, devices } from '@playwright/test';

// Disable Firefox background updates during automation; container-only launch prefs do not affect CI.
// CI installs all engines with their Linux dependencies. Local setup: npx playwright install --with-deps.
export default defineConfig({
  testDir: 'e2e',
  outputDir: process.env.ATLAS_TEST_OUTPUT || 'test-results/functional',
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || 'test-results/e2e.json' }]],
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173', trace: 'retain-on-failure', colorScheme: 'dark' },
  webServer: process.env.BASE_URL ? undefined : { command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.005 } },
  ...(process.env.ATLAS_VISUAL_BASELINE_DIR ? { snapshotPathTemplate: `${process.env.ATLAS_VISUAL_BASELINE_DIR}/{arg}-{projectName}-{platform}{ext}` } : {}),
  // Functional/accessibility coverage runs in every engine. Visual baselines and browser performance metrics
  // use one canonical Linux Chromium project so the same gate does not compare different font rasterizers.
  projects: [
    ...['chromium', 'firefox', 'webkit'].map(name => ({ name, testIgnore: ['**/layout.spec.ts', '**/visual.spec.ts', '**/perf.spec.ts', '**/review.spec.ts', '**/staging.spec.ts'], use: { ...devices[name === 'chromium' ? 'Desktop Chrome' : name === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'], viewport: { width: 1440, height: 1000 }, ...(name === 'firefox' ? { launchOptions: { firefoxUserPrefs: { 'app.update.disabledForTesting': true, 'app.update.checkInstallTime': false, ...(process.env.ATLAS_CONTAINER_BROWSER === '1' ? { 'media.rdd-process.enabled': false, 'security.sandbox.content.level': 0 } : {}) } } } : {}) } })),
    { name: 'layout-chromium', outputDir: process.env.ATLAS_TEST_OUTPUT || 'test-results/layout', testMatch: /(?:layout|perf)\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'off', video: 'off' } },
    { name: 'visual-chromium', outputDir: process.env.ATLAS_TEST_OUTPUT || 'test-results/visual', testMatch: /(?:visual|perf)\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'off', video: 'off' } },
  ],
});
