import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import routes from '../src/generated/routes.json' with { type: 'json' };
import { SAMPLE_TEXT } from './sample-text';

const modules = ['/', '/specifications', '/code', '/agents', '/resources', '/workflow', '/execution', '/governance', '/memory', '/gateway', '/collaboration',
  '/configuration', '/identity', '/tenancy', '/saas', '/desktop', '/observer', '/connection', '/definitions', '/definitions/agent', '/resources/drafts/mcp-resource', '/no-such-view'];
const views = (routes as { route: string }[]).map((r) => r.route).filter((r) => r !== '/');

async function audit(page: import('@playwright/test').Page, path: string, theme: 'dark' | 'light') {
  await page.addInitScript((t) => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(path);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page).toHaveTitle(/· Atlas$|^Atlas$/);
  const text = await page.locator('body').innerText();
  // T-3 targets the 210 planned business views. Module catalogs also disclose real design IDs and import limits.
  if (views.includes(path)) expect(text.match(SAMPLE_TEXT), `${path} production fixture leakage`).toBeNull();
  expect(text).not.toContain('Illustrative');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const v = r.violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(v, `${path} [${theme}]`).toEqual([]);
  expect(errors, `${path} console`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} horizontal overflow`).toBe(true);
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`modules · ${theme}`, () => {
    for (const p of modules) test(`${p}`, async ({ page }) => audit(page, p, theme));
  });
}
for (const theme of ['dark', 'light'] as const) test.describe(`all planned views · ${theme}`, () => {
  for (const p of views) test(`${p}`, async ({ page }) => audit(page, p, theme));
});
