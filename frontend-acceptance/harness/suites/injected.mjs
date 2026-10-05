// Runs the same scripts used with Cloudflare Browser Rendering (harness/remote/*.js) through Playwright,
// on chromium / firefox / webkit, so results are comparable across engines (FE04-XENGINE-001).
// req.injected = [{ script: 'fe02', engines: ['chromium','firefox','webkit'], viewport: {width,height,isMobile,hasTouch,deviceScaleFactor}, pre: ['detector'], url: '/', globals: {...}, timeout: 120000 }]
import fs from 'node:fs';
import path from 'node:path';
import * as pw from 'playwright';
import { Recorder, writeJSON } from '../lib.mjs';

const REMOTE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'remote');
const AXE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'node_modules', 'axe-core', 'axe.min.js');

export default async function ({ runDir, req, target }) {
  const rec = new Recorder(runDir, 'injected');
  const summary = [];
  for (const job of req.injected || []) {
    for (const engine of job.engines || ['chromium']) {
      const browser = await pw[engine].launch();
      const vp = job.viewport || { width: 1440, height: 900 };
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1, isMobile: engine !== 'firefox' && !!vp.isMobile, hasTouch: !!vp.hasTouch });
      const page = await ctx.newPage();
      const t0 = Date.now();
      let result = null, error = null;
      try {
        await page.goto(target + (job.url || '/'), { waitUntil: 'networkidle' });
        if (job.globals) await page.addScriptTag({ content: Object.entries(job.globals).map(([k, v]) => `window.${k}=${JSON.stringify(v)};`).join('') });
        if (job.script === 'axe') await page.addScriptTag({ path: AXE });
        for (const p of job.pre || []) await page.addScriptTag({ path: path.join(REMOTE, p + '.js') });
        await page.addScriptTag({ path: path.join(REMOTE, job.script + '.js') });
        await page.waitForSelector('#__atlas_done', { state: 'attached', timeout: job.timeout || 120000 });
      } catch (e) { error = String(e).slice(0, 500); }
      try { result = JSON.parse(await page.evaluate(() => document.getElementById('__atlas_out')?.textContent || 'null')); } catch (e) { error = (error || '') + ' parse:' + e; }
      const name = `${job.script}-${engine}-${vp.width}x${vp.height}${job.tag ? '-' + job.tag : ''}`;
      writeJSON(rec.evidenceFile(`${name}.json`, { evidence_type: 'injected-script-result', engine, viewport: `${vp.width}x${vp.height}` }), { job, engine, browserVersion: browser.version(), ms: Date.now() - t0, error, result });
      if (job.screenshot) await page.screenshot({ path: rec.evidenceFile(`${name}.png`, { evidence_type: 'screenshot', engine }), fullPage: true });
      summary.push({ name, ok: !error, ms: Date.now() - t0 });
      await browser.close();
    }
  }
  rec.save({ summary });
  return { jobs: summary.length, failed: summary.filter(s => !s.ok).length };
}
