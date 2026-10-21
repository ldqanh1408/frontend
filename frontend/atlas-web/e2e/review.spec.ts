import { test, expect } from '@playwright/test';
import { axe } from './helpers';
import routes from '../src/generated/routes.json' with { type: 'json' };
import states from '../src/generated/native-states.json' with { type: 'json' };
for (const theme of ['dark', 'light'] as const) for (const state of states) {
  test(`review native state ${state.key} · ${theme}`, async ({ page }) => {
    await page.addInitScript(t => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme);
    await page.goto(state.module === 'observer' ? `/observer/states/${state.key}` : `/states/${state.key}`);
    await expect(page.getByRole('heading', { level: 1, name: state.title })).toBeVisible();
    const frame = page.locator('[data-native-state]');
    await expect(frame.getByText('Illustrative', { exact: true })).toBeVisible();
    expect(await frame.locator('.kv dd').allTextContents()).toEqual([...state.panels.flatMap(p => p.rows), ...state.scope].map(r => r.example));
    await axe(page, `review ${state.key} ${theme}`);
  });
}
for (const theme of ['dark', 'light'] as const) {
  const batches = Array.from({ length: 10 }, (_, i) => routes.slice(i * 21, (i + 1) * 21));
  for (const [i, batch] of batches.entries()) test(`review labels ${theme} · batch ${i + 1}`, async ({ page }) => {
    await page.addInitScript(t => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme);
    for (const route of batch) {
      await page.goto(route.route); await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.getByText('Illustrative', { exact: true }).first(), route.route).toBeVisible();
    }
  });
  test(`execution states, inspector and keyboard list · ${theme}`, async ({ page }) => {
    await page.addInitScript(t => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme);
    await page.goto('/execution');
    const edges = page.locator('.react-flow__edge-path');
    await expect(edges).toHaveCount(8);
    // A valid path can still be invisible when the global SVG max-width reset
    // clamps React Flow's zero-width edge container. Check the paint viewport.
    await expect.poll(() => edges.evaluateAll(paths => paths.every(path =>
      (path.closest('svg')?.getBoundingClientRect().width ?? 0) > 0 && (path.getAttribute('d')?.length ?? 0) > 0
    ))).toBe(true);
    for (const state of ['running', 'parallel', 'checkpoint', 'failed', 'budget', 'paused', 'cleanup', 'completed']) {
      await page.getByLabel('Review run state').selectOption(state);
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveAttribute('aria-disabled', 'true');
      await axe(page, `execution ${state}`);
    }
    await page.getByRole('button', { name: 'List', exact: true }).click();
    const tasks = page.locator('.execution-list tbody button');
    await expect(tasks).toHaveCount(7);
    await tasks.first().focus(); await page.keyboard.press('Tab');
    await expect(tasks.nth(1)).toBeFocused(); await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Selected node' })).toContainText('Implement OAuth');
    for (const tab of ['Context', 'Access', 'Task']) await page.getByRole('tab', { name: tab, exact: true }).click();
    for (const tab of ['Terminal', 'Artifacts', 'Memory', 'Thought tree', 'Events']) await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.execution-list')).toContainText('MEMORY PREP');
    await axe(page, 'mobile execution list');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
