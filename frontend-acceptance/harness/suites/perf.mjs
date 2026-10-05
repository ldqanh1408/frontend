// FE-05: PERF-007 (cold/warm desktop, cold mobile throttled), PERF-INP-001 (trusted interactions, Event Timing),
// PERF-008 (30 route cycles, heap after GC). Budgets locked BEFORE measurement (web-vitals "good" thresholds):
const BUDGET = { LCP_p75: 2500, FCP_p75: 1800, CLS_p75: 0.1, INP: 200, HEAP_GROWTH_PCT: 10 };
import { chromium } from 'playwright';
import { Recorder, writeJSON } from '../lib.mjs';
import { EXP, waitH1, pct, errorHooks } from './common.mjs';

const OBSERVERS = `(() => {
  const m = window.__atlasPerf = { fcp: null, lcp: null, cls: 0, events: [] };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { const es = l.getEntries(); if (es.length) m.lcp = es[es.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.interactionId) m.events.push([e.interactionId, e.name, Math.round(e.duration)]); }).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch (e) {}
})();`;

async function sample(page) {
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const m = window.__atlasPerf || {};
    const n = performance.getEntriesByType('navigation')[0] || {};
    return { fcp: m.fcp && Math.round(m.fcp), lcp: m.lcp && Math.round(m.lcp), cls: Math.round((m.cls || 0) * 10000) / 10000, ttfb: Math.round(n.responseStart || 0), dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0), transfer: n.transferSize ?? null, vis: document.visibilityState, w: innerWidth };
  });
}

const stats = (rows, k) => ({ n: rows.filter(r => typeof r[k] === 'number').length, p50: pct(rows.map(r => r[k]), 50), p75: pct(rows.map(r => r[k]), 75), p95: pct(rows.map(r => r[k]), 95) });
const summarize = rows => Object.fromEntries(['fcp', 'lcp', 'cls', 'ttfb', 'dcl', 'load', 'transfer'].map(k => [k, stats(rows, k)]));
const verdict = s => ({ LCP: s.lcp.p75 !== null && s.lcp.p75 <= BUDGET.LCP_p75, FCP: s.fcp.p75 !== null && s.fcp.p75 <= BUDGET.FCP_p75, CLS: s.cls.p75 !== null && s.cls.p75 <= BUDGET.CLS_p75 });

export default async function ({ runDir, req, target }) {
  const rec = new Recorder(runDir, 'perf');
  const N = req.perf_runs || 10;
  const browser = await chromium.launch();
  const out = { budget: BUDGET, browserVersion: browser.version(), errors: [] };

  // PERF-007 desktop cold: fresh context per run
  const cold = [];
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(OBSERVERS);
    const page = await ctx.newPage(); errorHooks(page, out.errors);
    await page.goto(`${target}/#home`, { waitUntil: 'load' }); await waitH1(page, EXP.home);
    cold.push(await sample(page)); await ctx.close();
  }
  // warm: same context, reload
  const warm = [];
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(OBSERVERS);
    const page = await ctx.newPage(); errorHooks(page, out.errors);
    await page.goto(`${target}/#home`, { waitUntil: 'load' }); await waitH1(page, EXP.home); await page.waitForTimeout(1000);
    for (let i = 0; i < N; i++) { await page.reload({ waitUntil: 'load' }); await waitH1(page, EXP.home); warm.push(await sample(page)); }
    await ctx.close(); }
  // mobile cold throttled: CPU 4x, 1.6 Mbps down / 0.75 Mbps up, 150 ms RTT
  const mobile = [];
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    await ctx.addInitScript(OBSERVERS);
    const page = await ctx.newPage(); errorHooks(page, out.errors);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`${target}/#home`, { waitUntil: 'load', timeout: 90000 }); await waitH1(page, EXP.home, 30000);
    mobile.push(await sample(page)); await ctx.close();
  }
  out['PERF-007'] = { cold_desktop: { runs: cold, stats: summarize(cold) }, warm_desktop: { runs: warm, stats: summarize(warm) }, cold_mobile_throttled: { runs: mobile, stats: summarize(mobile) } };
  for (const k of ['cold_desktop', 'warm_desktop', 'cold_mobile_throttled']) out['PERF-007'][k].budget = verdict(out['PERF-007'][k].stats);

  // PERF-INP-001: >=30 trusted interactions (pointer + keyboard), desktop and CPU 4x
  for (const [label, cpu] of [['desktop', 1], ['cpu4x', 4]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(OBSERVERS);
    const page = await ctx.newPage(); errorHooks(page, out.errors);
    if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
    await page.goto(`${target}/#home`, { waitUntil: 'networkidle' }); await waitH1(page, EXP.home);
    let count = 0; const log = [];
    for (const r of Object.keys(EXP)) { const a = page.locator(`aside nav a[href="#${r}"], nav a[href="#${r}"]`).first(); if (await a.count()) { await a.click(); count++; await waitH1(page, EXP[r]); await page.waitForTimeout(150); log.push('nav:' + r); } }
    await page.locator('nav a[href="#specifications"]').first().click(); await waitH1(page, EXP.specifications);
    const tabs = page.locator('main [role=tab]');
    const nt = await tabs.count();
    for (let i = 0; i < nt; i++) { await tabs.nth(i).click(); count++; await page.waitForTimeout(150); log.push('tab:' + i); }
    for (let i = 0; i < 4; i++) { await page.locator('header button[title="Switch display theme"]').first().click(); count++; await page.waitForTimeout(150); log.push('theme'); }
    const search = page.locator('main input[type=text]').first();
    if (await search.count()) { await search.click(); count++; for (const ch of 'atlas') { await page.keyboard.press(ch); count++; } await page.waitForTimeout(200); log.push('typing'); }
    await page.waitForTimeout(800);
    const events = await page.evaluate(() => window.__atlasPerf.events);
    const byId = {}; for (const [id, name, d] of events) byId[id] = Math.max(byId[id] || 0, d);
    const durations = Object.values(byId);
    // interactions faster than the 16 ms threshold produce no entry: count them as "<16 ms"
    const filled = durations.concat(Array(Math.max(0, count - durations.length)).fill(16));
    const inp = filled.length >= 50 ? pct(filled, 98) : Math.max(...filled);
    out[`PERF-INP-001-${label}`] = { interactions: count, reported: durations.length, p50: pct(filled, 50), p75: pct(filled, 75), p95: pct(filled, 95), inp, pass: inp <= BUDGET.INP, slowest: events.sort((a, b) => b[2] - a[2]).slice(0, 8), log: log.length };
    await ctx.close();
  }

  // PERF-008: 30 route cycles, JS heap after forced GC, listeners and workers
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); errorHooks(page, out.errors);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto(`${target}/#home`, { waitUntil: 'networkidle' }); await waitH1(page, EXP.home);
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = await cdp.send('Performance.getMetrics'); const g = k => m.metrics.find(x => x.name === k)?.value; return { heap: g('JSHeapUsedSize'), nodes: g('Nodes'), listeners: g('JSEventListeners'), docs: g('Documents') }; };
    const cycle = async () => { for (const r of ['specifications', 'code', 'agents', 'connection', 'home']) { await page.evaluate(h => { location.hash = h; }, r); await waitH1(page, EXP[r]); } };
    await cycle(); await cycle();
    const h0 = await heap();
    for (let i = 0; i < 30; i++) await cycle();
    const h1 = await heap();
    const growth = h0.heap ? Math.round(((h1.heap - h0.heap) / h0.heap) * 1000) / 10 : null;
    const workers = (await cdp.send('Target.getTargets')).targetInfos.filter(t => /worker/.test(t.type)).map(t => t.type + ':' + t.url.split('/').pop());
    out['PERF-008'] = { before: h0, after: h1, heapGrowthPct: growth, workers, pass: growth !== null && growth <= BUDGET.HEAP_GROWTH_PCT && h1.listeners <= h0.listeners * 1.1, note: 'route switching via location.hash (navigation, not editor open/close); editor open/close cycle requires seeded documents' };
    await ctx.close(); }

  await browser.close();
  writeJSON(rec.evidenceFile('perf-results.json', { evidence_type: 'performance', input_mode: 'trusted-input (INP) / navigation' }), out);
  rec.save();
  const s = out['PERF-007'];
  return { cold_lcp_p75: s.cold_desktop.stats.lcp.p75, warm_lcp_p75: s.warm_desktop.stats.lcp.p75, mobile_lcp_p75: s.cold_mobile_throttled.stats.lcp.p75, inp: out['PERF-INP-001-desktop'].inp, heapGrowth: out['PERF-008'].heapGrowthPct };
}
