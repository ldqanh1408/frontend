import { test, expect } from '@playwright/test';
import { axe, trackErrors } from './helpers';

test('search finds and opens a device draft after the first fifty records', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('atlas-device', 2);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite');
      for (let i = 0; i < 65; i++) tx.objectStore('documents').put({ id: `search-${String(i).padStart(3, '0')}`, kind: 'document', parentId: null,
        name: i === 64 ? 'Late release candidate' : `Ordinary document ${i}`, content: '# Device draft', rev: 1,
        archived: false, favorite: false, properties: {}, createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z' });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.getByRole('button', { name: 'Search workspace' }).click();
  const input = page.getByRole('combobox', { name: 'Search workspace' });
  await expect(input).toBeFocused(); await input.fill('Late release candidate');
  await expect(page.getByRole('option', { name: /Late release candidate/ })).toBeVisible();
  await axe(page, 'device search');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/specifications\?doc=search-064$/);
  await expect(page.locator('.monaco-editor')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [320, 375, 768]) test(`readable status and touch actions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  const status = page.locator('.app-status');
  await expect(status).toContainText('Acknowledgement ≠ effective execution');
  const textFits = await status.evaluate(el => [...el.children].every(child => {
    const range = document.createRange(); range.selectNodeContents(child);
    const bounds = child.getBoundingClientRect();
    return [...range.getClientRects()].every(r => r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.bottom <= bounds.bottom + 1);
  }));
  expect(textFits).toBe(true);
  if (width <= 375) for (const name of ['Open workspace navigation', 'Search workspace', 'Open notification inbox']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [320, 375]) test(`text enlargement preserves scope and search navigation at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await page.goto('/configuration');
  await expect(page.locator('h1')).toBeVisible();
  const initial = await page.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(initial * 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.tenant-context > span > strong').evaluateAll(labels => labels.every(label => {
    const range = document.createRange(); range.selectNodeContents(label);
    const box = label.getBoundingClientRect();
    return [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1);
  })), 'Scope labels must fit their columns without overlapping adjacent labels').toBe(true);
  await page.getByRole('button', { name: 'Search workspace' }).click();
  const input = page.getByRole('combobox', { name: 'Search workspace' });
  await input.fill('help keyboard');
  await expect(page.getByRole('option', { name: 'Help and keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(input).toBeHidden();
  await expect(page.getByRole('button', { name: 'Search workspace' })).toBeFocused();
});

test('desktop sidebar does not show a duplicate drawer control', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open workspace navigation' })).toBeHidden();
});

test('reduced motion and system contrast retain keyboard focus and selection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.goto('/'); await expect(page.locator('h1')).toBeVisible();
  await page.getByRole('button', { name: 'Search workspace' }).click();
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.getByRole('combobox').fill('Switch theme');
  const selected = page.getByRole('option', { name: 'Switch theme' });
  await expect(selected).toHaveAttribute('data-selected', 'true');
  expect(await selected.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter'); await expect(page.getByRole('combobox')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Search workspace' })).toBeFocused();
});
