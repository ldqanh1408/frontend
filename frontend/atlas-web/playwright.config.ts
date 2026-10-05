import { defineConfig, devices } from '@playwright/test';

// Chromium is preinstalled in CI images and this container (PLAYWRIGHT_BROWSERS_PATH); no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: process.env.BASE_URL || 'http://localhost:4173', trace: 'retain-on-failure', colorScheme: 'dark' },
  webServer: process.env.BASE_URL ? undefined : { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
});
