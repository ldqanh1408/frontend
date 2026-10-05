// FE02-WALK-001: screenshot every module route after render, 375 (mobile) and 1440, dark and light (Chromium).
// Visual evidence only — not a PASS criterion by itself (v2 §2).
import { chromium } from 'playwright';
import { Recorder, writeJSON } from '../lib.mjs';
import { EXP, waitH1, settle, setTheme, errorHooks } from './common.mjs';

export default async function ({ runDir, req, target }) {
  const rec = new Recorder(runDir, 'screenshots');
  const browser = await chromium.launch();
  const shots = []; const errors = [];
  for (const vp of req.screenshot_viewports || [{ width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { width: 1440, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const page = await ctx.newPage(); errorHooks(page, errors);
    await page.goto(`${target}/#home`, { waitUntil: 'networkidle' }); await waitH1(page, EXP.home);
    for (const theme of ['dark', 'light']) {
      const got = await setTheme(page, theme);
      for (const r of Object.keys(EXP)) {
        await page.evaluate(h => { location.hash = h; }, r);
        const ok = await waitH1(page, EXP[r]); await settle(page); await page.waitForTimeout(150);
        const file = rec.evidenceFile(`${vp.width}x${vp.height}/${theme}/${r}.jpg`, { evidence_type: 'screenshot', viewport: `${vp.width}x${vp.height}`, theme, route: r });
        await page.screenshot({ path: file, type: 'jpeg', quality: 70, fullPage: false });
        shots.push({ route: r, theme: got, vp: `${vp.width}x${vp.height}`, h1ok: ok });
      }
    }
    await ctx.close();
  }
  await browser.close();
  writeJSON(rec.evidenceFile('screenshots-index.json', { evidence_type: 'screenshot-index' }), { shots, errors });
  rec.save();
  return { shots: shots.length, h1fail: shots.filter(s => !s.h1ok).length, errors: errors.length };
}
