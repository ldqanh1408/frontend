import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Public CI checks layout without publishing images. Pixel comparisons use private baselines.
const modules = ['home', 'specifications', 'code', 'agents', 'resources', 'workflow', 'execution', 'governance', 'memory', 'gateway', 'collaboration', 'configuration', 'identity', 'tenancy', 'saas', 'desktop', 'observer', 'connection', 'sign-in', 'sign-in/help', 'invitations', 'observer/sign-in'];
for (const theme of ['dark', 'light'] as const) for (const width of [390, 1024, 1440]) {
  test.describe(`${theme} · ${width}`, () => {
    test.use({ viewport: { width, height: 1000 }, colorScheme: theme });
    test.beforeEach(async ({ page }) => page.addInitScript(t => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme));
    async function checkLayout(page: Page) {
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      const box = await heading.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
    for (const module of modules) test(`layout ${module}`, async ({ page }) => {
      await page.goto(`/${module === 'home' ? '' : module}`, { waitUntil: 'networkidle' });
      await checkLayout(page);
    });
    for (const module of ['specifications', 'code', 'agents']) test(`layout open ${module}`, async ({ page }) => {
      await page.goto(`/${module}`, { waitUntil: 'networkidle' });
      if (module === 'specifications') { await page.getByRole('button', { name: 'New document' }).first().click(); await page.getByLabel('Name').fill('Acceptance document'); await page.getByRole('button', { name: 'Create', exact: true }).click(); await expect(page.locator('.monaco-editor')).toBeVisible(); }
      else if (module === 'code') { await page.locator('input[type=file]').setInputFiles(path.resolve('e2e/fixtures/source')); await page.getByRole('treeitem', { name: /sample\.ts/ }).click(); await expect(page.locator('.monaco-editor')).toBeVisible(); }
      else { await page.getByRole('button', { name: 'New agent' }).first().click(); await page.fill('#definition-name', 'Acceptance agent'); }
      await checkLayout(page);
    });
  });
}
