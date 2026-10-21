// Validate the offline review artifact's navigation and embedded images, not backend acceptance.
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const [file, out] = process.argv.slice(2);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let states = 0;
try {
  await page.goto(pathToFileURL(file).href);
  const section = async key => page.locator(`[data-section="${key}"]`).click();
  const ready = async () => {
    assert.equal(await page.locator('section:visible').getByText('Ảnh chưa có:', { exact: false }).count(), 0);
    await page.waitForFunction(() => [...document.querySelectorAll('section:not([hidden]) .image-wrap img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    states++;
  };
  const values = id => page.locator(`#${id} option`).evaluateAll(options => options.map(o => o.value));
  for (const theme of ['dark', 'light']) {
    await page.selectOption('#preview-theme', theme);
    for (const value of await values('preview-page')) for (const width of ['1440', '1024', '390']) {
      await page.selectOption('#preview-page', value); await page.selectOption('#preview-width', width); await ready();
    }
    await page.selectOption('#preview-page', 'execution'); await page.selectOption('#preview-width', '1440');
    for (const value of await values('preview-state')) { await page.selectOption('#preview-state', value); await ready(); }
    await section('comparison'); await page.selectOption('#compare-theme', theme);
    for (const value of await values('compare-page')) { await page.selectOption('#compare-page', value); await ready(); }
    await section('states'); await page.selectOption('#state-theme', theme);
    for (const group of ['definition', 'current', 'scene']) {
      await page.selectOption('#state-group', group);
      for (const value of await values('state-key')) { await page.selectOption('#state-key', value); await ready(); }
    }
    await section('preview');
  }
  await section('archive');
  const candidates = await page.locator('#archive-rows button').allTextContents();
  for (const theme of ['dark','light']) { await page.selectOption('#archive-theme',theme); for (const name of candidates) { await page.locator('#archive-rows').getByRole('button', { name, exact: true }).click(); await ready(); } }
  const audits = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const key of ['preview', 'comparison', 'archive', 'states', 'quality']) {
      await section(key); await ready();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map(v => ({ id: v.id, target: v.nodes.map(n => n.target) }))));
      audits.push({ width, section: key, violations: 0 });
    }
  }
  await section('preview');
  const trigger = page.getByRole('button', { name: 'Mở ảnh lớn' }).first(); await trigger.click();
  await page.getByRole('dialog').waitFor(); await page.selectOption('#zoom-scale', '200');
  assert.equal((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.length, 0);
  await page.keyboard.press('Escape'); assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: out.replace('.json', '-390.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: out.replace('.json', '-1440.png') });
  const result = { selected_image_states: states, sections_axe: audits, dialog_axe: 0, console_errors: errors, horizontal_overflow: false };
  await writeFile(out, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
