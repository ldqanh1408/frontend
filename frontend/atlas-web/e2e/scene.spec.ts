import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { axe } from './helpers';
import { SAMPLE_TEXT } from './sample-text';
const scenes = readdirSync('src/generated/scenes').flatMap(file => JSON.parse(readFileSync(`src/generated/scenes/${file}`, 'utf8')) as { id: string; key: string; kind: string; planned: string[] }[]);
for (const kind of ['ide', 'review', 'table', 'statepattern', 'run', 'observer', 'trace', 'terminal', 'diff', 'merge', 'plan', 'tasklist', 'workflow', 'palette']) {
  const scene = scenes.find(s => s.kind === kind && (kind === 'tasklist' || !/^execution(?:-|$)/.test(s.key)))!;
  test(`dedicated ${kind} template without service`, async ({ page }) => {
    // A query-state can also exercise unplanned prototype substates through the existing scene router.
    await page.goto(`/execution/runs?state=${encodeURIComponent(scene.id)}`);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('[data-scene-template], [data-execution-workspace]').first()).toBeVisible();
    expect((await page.locator('body').innerText()).match(SAMPLE_TEXT)).toBeNull();
    const buttons = page.locator('[data-action-kind="effect"]');
    for (let i = 0; i < await buttons.count(); i++) {
      await expect(buttons.nth(i)).toHaveAttribute('aria-disabled', 'true');
      const reason = await buttons.nth(i).getAttribute('aria-describedby');
      expect(reason).toBeTruthy();
      expect(await page.evaluate(id => document.getElementById(id!)?.textContent, reason)).toBeTruthy();
    }
    await axe(page, kind);
  });
}
test('mobile IDE reveals imported source and switches panels without document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/code');
  await expect(page.getByRole('button', { name: 'Explorer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/source');
  await page.getByRole('treeitem', { name: /sample\.ts/ }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Symbols & quality' })).toBeVisible();
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await axe(page, 'mobile code panels');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
