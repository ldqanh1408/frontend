// FE02-SCROLL-001 (FND-018 root cause): after navigating from outside <main> (mobile drawer link, header control), the app
// focuses <main>; check that the view's top (breadcrumb, h1) is not left hidden under the fixed header. Trusted pointer input.
// Expected (fixed before run): breadcrumb link and main h1 are hit-testable at their centres (elementFromPoint returns them),
// i.e. not covered by the fixed header, after every navigation path; on all engines.
import * as pw from 'playwright';
import { Recorder, writeJSON } from '../lib.mjs';
import { EXP, waitH1, errorHooks } from './common.mjs';

const MEASURE = () => {
  const a = [...document.querySelectorAll('main a')].find(x => x.textContent.trim() === 'Workspace');
  const h = document.querySelector('main h1');
  const hit = e => { if (!e) return 'missing'; const q = e.getBoundingClientRect(); const t = document.elementFromPoint(q.x + Math.min(q.width / 2, 20), q.y + q.height / 2); return t === e || e.contains(t) ? null : (t ? t.tagName + '.' + String(t.getAttribute('class') || '').slice(0, 40) : 'none'); };
  const r = e => { if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)]; };
  const hd = document.querySelector('header');
  return { hash: location.hash, scrollY: Math.round(scrollY), header: r(hd), headerPos: getComputedStyle(hd).position, breadcrumb: r(a), breadcrumbCoveredBy: hit(a), h1: r(h), h1CoveredBy: hit(h), active: document.activeElement.tagName + '#' + document.activeElement.id };
};

export default async function ({ runDir, req, target }) {
  const rec = new Recorder(runDir, 'layout');
  const out = {};
  for (const engine of req.layout_engines || ['chromium', 'firefox', 'webkit']) {
    const browser = await pw[engine].launch();
    const res = out[engine] = { browserVersion: browser.version(), paths: [] };
    for (const vp of [{ width: 375, height: 812, mobile: true }, { width: 320, height: 800, mobile: true }, { width: 1440, height: 900 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile && engine !== 'firefox', hasTouch: !!vp.mobile });
      const page = await ctx.newPage(); const errs = []; errorHooks(page, errs);
      await page.goto(`${target}/#home`, { waitUntil: 'networkidle' }); await waitH1(page, EXP.home);
      res.paths.push({ vp: vp.width, path: 'initial load #home', ...(await page.evaluate(MEASURE)) });
      for (const r of ['memory', 'agents', 'connection']) {
        if (vp.mobile) {
          await page.locator('header button[title="Open workspace navigation"]').click();
          await page.waitForTimeout(400);
          await page.locator('[aria-modal=true] a[href="#' + r + '"], [role=dialog] a[href="#' + r + '"]').first().click();
        } else {
          await page.locator('aside nav a[href="#' + r + '"]').first().click();
        }
        await waitH1(page, EXP[r]); await page.waitForTimeout(500);
        res.paths.push({ vp: vp.width, path: (vp.mobile ? 'drawer link → #' : 'sidebar link → #') + r, ...(await page.evaluate(MEASURE)) });
      }
      await page.locator('header button[title="Switch display theme"]').click(); await page.waitForTimeout(300);
      await page.evaluate(() => { location.hash = 'specifications'; }); await waitH1(page, EXP.specifications); await page.waitForTimeout(500);
      res.paths.push({ vp: vp.width, path: 'header theme button, then route change → #specifications', ...(await page.evaluate(MEASURE)) });
      res.errors = (res.errors || []).concat(errs);
      await ctx.close();
    }
    res.covered = res.paths.filter(p => p.breadcrumbCoveredBy || p.h1CoveredBy).map(p => `${p.vp}:${p.path}: breadcrumb=${p.breadcrumbCoveredBy} h1=${p.h1CoveredBy} scrollY=${p.scrollY}`);
    await browser.close();
  }
  writeJSON(rec.evidenceFile('layout-results.json', { evidence_type: 'layout-hit-test', input_mode: 'trusted-input' }), out);
  rec.save();
  return Object.fromEntries(Object.entries(out).map(([e, v]) => [e, `covered=${v.covered.length}/${v.paths.length}`]));
}
