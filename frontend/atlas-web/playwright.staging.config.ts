import { defineConfig, devices } from '@playwright/test';
const workspace = process.env.WORKSPACE_URL;
const observer = process.env.OBSERVER_URL;
if (!workspace || !observer || !process.env.EXPECTED_BUILD_ID) throw new Error('Staging acceptance requires WORKSPACE_URL, OBSERVER_URL and EXPECTED_BUILD_ID.');
for (const target of [workspace, observer]) {
  const url = new URL(target);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Staging targets must be HTTPS URLs without credentials, query or fragment.');
}
if (new URL(workspace).origin === new URL(observer).origin) throw new Error('Workspace and Observer require independent staging origins.');
export default defineConfig({
  testDir: 'e2e', testMatch: '**/staging.spec.ts', outputDir: process.env.ATLAS_TEST_OUTPUT || 'test-results/staging',
  timeout: 120_000, fullyParallel: true, workers: 2, retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || 'test-results/staging.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', colorScheme: 'dark' },
  projects: ['workspace', 'observer'].flatMap(audience => ['chromium', 'firefox', 'webkit'].map(engine => ({
    name: `${audience}-${engine}`, metadata: { audience },
    use: { ...devices[engine === 'chromium' ? 'Desktop Chrome' : engine === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'], ...(engine === 'firefox' ? { launchOptions: { firefoxUserPrefs: { 'app.update.disabledForTesting': true, 'app.update.checkInstallTime': false } } } : {}), baseURL: audience === 'workspace' ? workspace : observer, viewport: { width: 1440, height: 1000 } },
  }))),
});
