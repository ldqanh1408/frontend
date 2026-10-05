// Discovery crawl (Chromium, headless, visible document): router type, hash routes,
// per-route aria snapshot + screenshot + runtime errors. Informational: feeds test design.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { Recorder, writeJSON } from '../lib.mjs';

export default async function ({ runDir, target }) {
  const rec = new Recorder(runDir, 'discover');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push({ type: 'pageerror', msg: String(e).slice(0, 500), url: page.url() }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console.error', msg: m.text().slice(0, 500), url: page.url() }); });
  page.on('requestfailed', r => errors.push({ type: 'requestfailed', msg: `${r.url()} ${r.failure()?.errorText}`, url: page.url() }));
  await page.goto(`${target}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const env = await page.evaluate(() => ({ visibilityState: document.visibilityState, innerWidth, innerHeight, ua: navigator.userAgent, hash: location.hash, title: document.title, theme: document.documentElement.dataset.theme || null, lang: document.documentElement.lang }));
  const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))]);
  const hashRoutes = hrefs.filter(h => h && h.startsWith('#'));
  writeJSON(rec.evidenceFile('env.json', { evidence_type: 'environment' }), { env, browserVersion: browser.version(), hrefs });
  await page.screenshot({ path: rec.evidenceFile('screens/root.png', { evidence_type: 'screenshot', viewport: '1440x900' }), fullPage: false });
  const routes = [];
  for (const h of hashRoutes) {
    await page.evaluate(x => { location.hash = x; }, h);
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => ({
      hash: location.hash,
      title: document.title,
      h1: [...document.querySelectorAll('h1,h2')].slice(0, 12).map(x => `${x.tagName}:${x.textContent.trim().slice(0, 80)}`),
      buttons: [...document.querySelectorAll('button,[role=button]')].slice(0, 60).map(b => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 60)),
      inputs: [...document.querySelectorAll('input,select,textarea')].slice(0, 40).map(i => `${i.tagName}:${i.type || ''}:${i.name || i.id || i.getAttribute('aria-label') || ''}`),
      roles: [...new Set([...document.querySelectorAll('[role]')].map(e => e.getAttribute('role')))],
      textLen: document.body.innerText.length,
    }));
    let aria = '';
    try { aria = await page.locator('body').ariaSnapshot({ timeout: 5000 }); } catch (e) { aria = `ERR ${e}`; }
    const slug = h.replace(/[^a-z0-9]+/gi, '_');
    fs.writeFileSync(rec.evidenceFile(`aria/${slug}.yml`, { evidence_type: 'aria-snapshot', route: h }), aria);
    await page.screenshot({ path: rec.evidenceFile(`screens/${slug}.png`, { evidence_type: 'screenshot', route: h, viewport: '1440x900' }) });
    routes.push({ href: h, ...info });
  }
  // Reload-on-hash keeps route (deep link / refresh)
  const reloadChecks = [];
  for (const h of hashRoutes.slice(0, 40)) {
    await page.goto(`${target}/${h}`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    reloadChecks.push({ href: h, after: await page.evaluate(() => location.hash), h1: await page.evaluate(() => document.querySelector('h1')?.textContent?.trim().slice(0, 80) || null) });
  }
  writeJSON(rec.evidenceFile('routes.json', { evidence_type: 'route-crawl' }), { routes, reloadChecks, errors });
  rec.save({ routeCount: hashRoutes.length });
  await browser.close();
  return { routes: hashRoutes.length, errors: errors.length };
}
