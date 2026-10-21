import { test, expect } from '@playwright/test';
import states from '../src/generated/native-states.json' with { type: 'json' };
import { axe, trackErrors } from './helpers';

for (const theme of ['dark', 'light'] as const) for (const state of states) {
  test(`native state ${state.key} · ${theme}`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(t => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme);
    await page.goto(state.module === 'observer' ? `/observer/states/${state.key}` : `/states/${state.key}`);
    await expect(page.getByRole('heading', { level: 1, name: state.title })).toBeVisible();
    const frame = page.locator('[data-native-state]');
    for (const panel of state.panels) await expect(frame.getByRole('heading', { name: panel.title, exact: true })).toBeVisible();
    const values = await frame.locator('.kv dd').allTextContents();
    expect(values.length).toBeGreaterThan(8);
    expect(values.every(v => v === 'Not observed')).toBe(true);
    for (const action of state.actions) {
      if (state.module === 'observer' && action === 'Connect observer') continue;
      await expect(frame.getByRole('button', { name: action, exact: true })).toHaveAttribute('aria-disabled', 'true');
    }
    await axe(page, `${state.key} ${theme}`);
    for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${state.key} at ${width}`).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
