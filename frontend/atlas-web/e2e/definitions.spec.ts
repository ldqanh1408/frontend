import { test, expect } from '@playwright/test';
import { axe, trackErrors } from './helpers';

test('author, validate, save, compare and archive a definition', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/definitions/routing-policy');
  await page.getByRole('button', { name: 'Create local definition' }).click();
  await expect(page.locator('#definition-name')).toBeVisible();
  await page.getByRole('button', { name: 'Validate complete definition' }).click();
  const summary = page.locator('.error-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await axe(page, 'validation errors');
  const first = summary.locator('a').first();
  await first.click();
  await expect(page.locator(':focus')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#definition-name', 'Primary routing');
  await page.getByRole('button', { name: 'Save local revision' }).click();
  await expect(page.getByText('Device revision 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'History / compare' }).click();
  await expect(page.getByRole('dialog', { name: 'Saved definition history' })).toBeVisible();
  await axe(page, 'history dialog');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Archived definitions are read-only.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('unsaved changes are guarded on navigation', async ({ page }) => {
  await page.goto('/definitions/agent');
  await page.getByRole('button', { name: 'Create local definition' }).click();
  await page.fill('#definition-name', 'Edited but not saved');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Overview' }).click();
  const dlg = page.getByRole('dialog', { name: 'Leave with unsaved changes?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Stay and edit' }).click();
  await expect(page.locator('#definition-name')).toHaveValue('Edited but not saved');
});

test('every definition type can be created with defaults (FND-004)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/definitions');
  await expect(page.locator('a.def-card')).toHaveCount(49);
  const hrefs = await page.locator('a.def-card').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBe(49);
  for (const h of hrefs) {
    await page.goto(h);
    await page.getByRole('button', { name: 'Create local definition' }).click();
    await expect(page.locator('#definition-name'), h).toBeVisible();
  }
});

test('agents workbench follows the Figma frame: tabs, gated lifecycle, readiness and versions', async ({ page }) => {
  await page.goto('/agents');
  await page.getByRole('button', { name: 'New agent' }).first().click();
  for (const t of ['Instructions', 'Model', 'Tools', 'Resources', 'Memory', 'Guardrails', 'Readiness', 'Versions']) await expect(page.getByRole('tab', { name: t })).toBeVisible();
  for (const a of ['Evaluate', 'Publish', 'Assign']) await expect(page.getByRole('button', { name: a, exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Validate draft' }).click();
  await expect(page.locator('.error-summary')).toBeVisible();
  await page.locator('.error-summary a', { hasText: 'Pinned model resource reference' }).click();
  await expect(page.getByRole('tab', { name: /Model/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(':focus')).toHaveAttribute('id', 'definition-model');
  await axe(page, 'agents workbench');
  await page.getByRole('tab', { name: /Readiness/ }).click();
  await expect(page.getByText('Local field checks')).toBeVisible();
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.getByText('Device revisions (1)')).toBeVisible();
  await axe(page, 'agents versions');
});

test('own saves never raise a conflict; a save from another tab does', async ({ page, context }) => {
  await page.goto('/agents');
  await page.getByRole('button', { name: 'New agent' }).first().click();
  await page.fill('#definition-name', 'Shared agent');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Device draft · r2')).toBeVisible();
  await expect(page.getByText('Changed in another tab')).toHaveCount(0);
  const url = page.url();
  const other = await context.newPage();
  await other.goto(url);
  await other.fill('#definition-name', 'Edited in tab B');
  await page.fill('#definition-name', 'Edited in tab A');
  await other.getByRole('button', { name: 'Save draft' }).click();
  await expect(other.getByText('Device draft · r3')).toBeVisible();
  await expect(page.getByText('Changed in another tab')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
});
