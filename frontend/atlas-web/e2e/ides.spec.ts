import { test, expect } from '@playwright/test';
import path from 'node:path';
import { axe, trackErrors } from './helpers';

test('specifications: create, edit, save, outline, preview, history', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/specifications');
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('Name').fill('Product');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'New document' }).first().click();
  await page.getByLabel('Name').fill('Checkout');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await page.locator('.monaco-editor').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n## Payments\n\nREQ-9: charge once\n');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByText('Device revision 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Payments/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.locator('.doc-preview h2', { hasText: 'Payments' })).toBeVisible();
  await axe(page, 'specifications editor');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('dialog', { name: 'Document history' })).toBeVisible();
  await axe(page, 'document history');
  await page.keyboard.press('Escape');
  // keyboard tree navigation
  const tree = page.getByRole('tree', { name: 'Specification documents' });
  await tree.getByRole('treeitem', { name: /Product/ }).first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(':focus')).toHaveAttribute('aria-level', '2');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator(':focus')).toHaveAttribute('aria-level', '1');
  expect(errors).toEqual([]);
});

test('specifications: preview never runs scripts from Markdown', async ({ page }) => {
  await page.goto('/specifications');
  await page.getByRole('button', { name: 'New document' }).first().click();
  await page.getByLabel('Name').fill('XSS probe');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('.monaco-editor').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>[x](javascript:window.__pwned=3)\n');
  await page.getByRole('tab', { name: 'Preview' }).click();
  await page.locator('.doc-preview a').first().click().catch(() => {});
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.locator('.doc-preview script, .doc-preview [onerror]').count()).toBe(0);
});

test('code intelligence: import folder, search, outline symbols', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/code');
  await page.locator('input[type=file]').setInputFiles(path.resolve('src/lib'));
  await expect(page.getByRole('tree')).toBeVisible();
  await page.getByRole('treeitem', { name: /storage\.ts/ }).click();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await page.getByLabel('Search source').fill('putVersioned');
  await expect(page.getByRole('status').filter({ hasText: 'matches' })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze JS/TS' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'symbols' })).toBeVisible();
  // Definition / References act on the symbol picked in Symbols & quality.
  await page.getByRole('list', { name: 'Symbols in this file' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'References', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^References · / })).toBeVisible();
  await axe(page, 'code intelligence');
  expect(errors).toEqual([]);
});

test('workflow: tasks, pinned agent, cycle detection, save', async ({ page }) => {
  await page.goto('/agents');
  await page.getByRole('button', { name: 'New agent' }).first().click();
  await page.fill('#definition-name', 'Implementer');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Device draft · r2')).toBeVisible();
  await page.goto('/workflow');
  await page.getByRole('button', { name: 'New workflow' }).first().click();
  await page.getByLabel('Name').fill('Delivery');
  await page.getByRole('button', { name: 'Create' }).click();
  for (const title of ['Design', 'Build']) {
    await page.getByRole('button', { name: 'Add task' }).first().click();
    await page.fill('#task-title', title);
    await page.selectOption('#task-agent', { index: 1 });
    await page.fill('#task-out', 'Report');
    await axe(page, 'task dialog');
    await page.getByRole('button', { name: 'Apply' }).click();
  }
  await page.getByRole('button', { name: /^T-01/ }).click();
  await page.getByRole('checkbox', { name: /T-02/ }).check();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Validate draft' }).click();
  await expect(page.locator('.error-summary')).toContainText('Cycle');
  await page.getByRole('button', { name: /^T-01/ }).click();
  await page.getByRole('checkbox', { name: /T-02/ }).uncheck();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Device revision 2', { exact: true })).toBeVisible();
  await axe(page, 'workflow');
});
