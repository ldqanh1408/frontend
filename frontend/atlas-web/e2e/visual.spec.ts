import { test, expect } from '@playwright/test';
import path from 'node:path';
const modules = ['home', 'specifications', 'code', 'agents', 'resources', 'workflow', 'execution', 'governance', 'memory', 'gateway', 'collaboration', 'configuration', 'identity', 'tenancy', 'saas', 'desktop', 'observer', 'connection'];
for (const theme of ['dark', 'light'] as const) for (const width of [390, 1024, 1440]) {
  test.describe(`${theme} · ${width}`, () => {
    test.use({ viewport: { width, height: 1000 }, colorScheme: theme });
    test.beforeEach(async ({ page }) => page.addInitScript(t => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme));
    for (const module of [...modules, 'sign-in', 'sign-in/help', 'invitations', 'observer/sign-in']) test(`visual ${module}`, async ({ page }) => {
      await page.goto(`/${module === 'home' ? '' : module}`, { waitUntil: 'networkidle' });
      await expect(page.locator('h1').first()).toBeVisible(); await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${module.replaceAll('/', '-')}-${theme}-${width}.png`, { fullPage: true });
    });
    for (const module of ['specifications', 'code', 'agents']) test(`visual open ${module}`, async ({ page }) => {
      await page.goto(`/${module}`, { waitUntil: 'networkidle' });
      if (module === 'specifications') { await page.getByRole('button', { name: 'New document' }).first().click(); await page.getByLabel('Name').fill('Acceptance document'); await page.getByRole('button', { name: 'Create', exact: true }).click(); await expect(page.locator('.monaco-editor')).toBeVisible(); }
      else if (module === 'code') { await page.locator('input[type=file]').setInputFiles(path.resolve('e2e/fixtures/source')); await page.getByRole('treeitem', { name: /sample\.ts/ }).click(); await expect(page.locator('.monaco-editor')).toBeVisible(); }
      else { await page.getByRole('button', { name: 'New agent' }).first().click(); await page.fill('#definition-name', 'Acceptance agent'); }
      await expect(page).toHaveScreenshot(`open-${module}-${theme}-${width}.png`, { fullPage: true, mask: [page.locator('.toast-region'), page.locator('.service-observed'), page.locator('.workbench-title'), page.locator('.tree-name'), page.locator('.source-stamp'), page.locator('.kv dd')] });
    });
  });
}
