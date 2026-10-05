// PERF-007 cold sample (one per fresh Browser Rendering session) + warm samples via same-origin iframe reloads.
// Budgets locked before measurement: LCP p75 <= 2500 ms, FCP p75 <= 1800 ms, CLS p75 <= 0.1 (web-vitals thresholds).
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.style.display = 'none'; document.body.appendChild(pre);
  const out = { cold: null, warm: [] };
  const flush = () => { pre.textContent = JSON.stringify(out); };
  const measure = (win) => new Promise(res => {
    const r = { fcp: null, lcp: null, cls: 0, nav: null };
    const P = win.PerformanceObserver;
    try { new P(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') r.fcp = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
    try { new P(l => { const es = l.getEntries(); if (es.length) r.lcp = Math.round(es[es.length - 1].startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
    try { new P(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) r.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
    const n = win.performance.getEntriesByType('navigation')[0];
    if (n) r.nav = { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transfer: n.transferSize };
    setTimeout(() => { r.cls = Math.round(r.cls * 10000) / 10000; res(r); }, 1500);
  });
  out.cold = await measure(window); out.cold.vis = document.visibilityState; flush();
  for (let i = 0; i < (window.__WARM_N || 10); i++) {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:9999';
    await new Promise(r => { f.onload = r; f.src = '/?warm=' + i + '#home'; document.body.appendChild(f); });
    await sleep(300);
    out.warm.push(await measure(f.contentWindow)); f.remove(); flush();
  }
  out.complete = 1; flush();
  const d = document.createElement('i'); d.id = '__atlas_done'; document.body.appendChild(d);
})();
