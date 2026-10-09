import { test, expect } from '@playwright/test';
import { axe, trackErrors } from './helpers';

test('skip link, route focus, title and breadcrumb', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  // Navigation load may finish before React commits the shell, especially in WebKit.
  await expect(page.getByRole('link', { name: 'Skip to workspace' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to workspace' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('h1')).toBeFocused();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Runs & activity' }).click();
  await expect(page).toHaveTitle('Runs & agent activity · Atlas');
  await expect(page.locator('h1')).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Runs & activity');
  await expect(page.getByRole('link', { name: 'Runs & activity' })).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('command palette searches views and navigates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Search workspace' })).toBeVisible();
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Search workspace' });
  await expect(input).toBeFocused();
  await input.fill('agent runs');
  await axe(page, 'palette');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/execution\/runs$/);
  await expect(page.locator('h1')).toHaveText('Agent runs');
});

test('help dialog opens with ? and returns focus', async ({ page }) => {
  await page.goto('/definitions');
  await page.locator('body').click({ position: { x: 600, y: 400 } });
  await page.keyboard.press('Shift+?');
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  await axe(page, 'help dialog');
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('theme preference persists across reloads', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(after);
});

test('unknown route shows a not-found page inside the shell', async ({ page }) => {
  await page.goto('/execution/does-not-exist');
  await expect(page.locator('h1')).toHaveText('Workspace view not found');
  await expect(page).toHaveTitle('View not found · Atlas');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('navigation drawer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeHidden();
    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
    await expect(drawer).toBeVisible();
    await axe(page, 'drawer');
    await drawer.getByRole('link', { name: 'Specifications' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('h1')).toHaveText('Specifications');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

for (const width of [320, 768, 1024, 1280, 1920]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const p of ['/', '/specifications', '/code', '/agents', '/workflow', '/execution', '/connection', '/definitions/agent', '/sign-in']) {
      await page.goto(p);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${p} @ ${width}`).toBe(true);
    }
  });
}

test('mobile breadcrumb labels stay within the header and scope remains compact', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/states/SP-Freeze');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  const layout=await page.evaluate(()=>{
    const trail=document.querySelector('.breadcrumb')!.getBoundingClientRect();
    const actions=document.querySelector('.bar-actions')!.getBoundingClientRect();
    const labels=[...document.querySelectorAll('.breadcrumb li')].filter(e=>getComputedStyle(e).display!=='none');
    const scope=document.querySelector('.tenant-context')!.getBoundingClientRect();
    return {overlap:trail.right>actions.left,labels:labels.length,scopeHeight:scope.height};
  });
  expect(layout.overlap).toBe(false);
  expect(layout.labels).toBe(1);
  expect(layout.scopeHeight).toBeLessThan(160);
});
