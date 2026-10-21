import { test, expect } from '@playwright/test';
import { axe, trackErrors } from './helpers';

test('memory hub searches knowledge type and keeps saved episodic drafts in its review queue', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/definitions/memory');
  await page.getByRole('button', { name: 'Create local definition' }).click();
  await page.fill('#definition-name', 'Checkout lessons');
  await expect(page.locator('#definition-name')).toHaveValue('Checkout lessons');
  await page.getByLabel('Memory layer', { exact: true }).selectOption('episodic');
  await page.getByRole('button', { name: 'Save local revision', exact: true }).click();
  await expect(page.getByText('Device revision 2', { exact: true })).toBeVisible();
  await page.goto('/memory');
  const hub = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Workspace memory layers', exact: true }) });
  await hub.getByLabel('Search knowledge drafts').fill('episodic');
  const row = hub.getByRole('row').filter({ hasText: 'Checkout lessons' });
  await expect(row).toContainText('episodic');
  await expect(row).toContainText('Device draft');
  await hub.getByRole('tab', { name: 'Review queue', exact: true }).click();
  await expect(hub.getByRole('row').filter({ hasText: 'Checkout lessons' })).toBeVisible();
  await axe(page, 'memory hub with an episodic draft');
  await hub.getByLabel('Search knowledge drafts').fill('unmatched');
  await expect(hub.getByText('No matching knowledge drafts', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
