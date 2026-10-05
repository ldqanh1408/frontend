import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import nav from '../src/generated/nav.json' with { type: 'json' };

// Text parity with the Figma "01/02 · Current UI" module frames: every frame title, purpose and control label should be
// present in the page in the state the frame depicts (a draft/document/file open). Coverage is printed per module.
type Mod = { title: string; purpose: string; controls: string[] };
const modules = nav.modules as Record<string, Mod>;
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

async function prepare(page: Page, r: string) {
  const go = (p: string) => page.goto(p, { waitUntil: 'networkidle' });
  if (r === 'specifications') {
    await go('/specifications');
    await page.getByRole('button', { name: 'New document' }).first().click();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
  } else if (r === 'code') {
    await go('/code');
    await page.locator('input[type=file]').setInputFiles(path.resolve('src/lib'));
    await page.getByRole('treeitem', { name: /storage\.ts/ }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
  } else if (['agents', 'resources', 'memory', 'configuration'].includes(r)) {
    await go(`/${r}`);
    await page.locator('.page-head').getByRole('button', { name: /^New / }).click();
    await expect(page.locator('#definition-name')).toBeVisible();
  } else if (r === 'workflow') {
    await go('/workflow');
    await page.getByRole('button', { name: 'New workflow' }).first().click();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('button', { name: 'Add task' }).first()).toBeVisible();
  } else await go(r === 'home' ? '/' : `/${r}`);
}

const results: Record<string, { hit: number; total: number; missing: string[] }> = {};
for (const [r, m] of Object.entries(modules)) {
  test(`figma parity ${r}`, async ({ page }) => {
    await prepare(page, r);
    const text = norm(await page.evaluate(() => `${document.body.innerText} ${[...document.querySelectorAll('[aria-label],[placeholder]')].map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('placeholder') ?? ''}`).join(' ')}`));
    const labels = [m.title, m.purpose, ...m.controls];
    const missing = labels.filter((l) => !text.includes(norm(l)));
    results[r] = { hit: labels.length - missing.length, total: labels.length, missing };
    console.log(`PARITY ${r} ${labels.length - missing.length}/${labels.length}${missing.length ? ` missing: ${missing.join(' | ')}` : ''}`);
    expect(labels.length - missing.length, `${r}: ${missing.join(' | ')}`).toBeGreaterThanOrEqual(Math.ceil(labels.length * 0.7));
  });
}
