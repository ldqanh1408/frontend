import { test, expect } from '@playwright/test';

// Cold-load budgets per page (desktop, no throttling) plus transferred bytes. Numbers are printed for the report.
const PAGES = ['/', '/specifications', '/code', '/agents', '/workflow', '/execution', '/definitions/agent', '/execution/runs'];

for (const p of PAGES) {
  test(`perf ${p}`, async ({ page }) => {
    await page.goto(p, { waitUntil: 'networkidle' });
    await expect(page.locator('h1').first()).toBeVisible();
    const m = await page.evaluate(async () => {
      const lcp = await new Promise<number>((resolve) => {
        new PerformanceObserver((l) => { const e = l.getEntries(); resolve(e[e.length - 1]?.startTime ?? 0); }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(-1), 3000);
      });
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const js = res.filter((r) => r.name.endsWith('.js'));
      const cls = await new Promise<number>((resolve) => {
        let v = 0; new PerformanceObserver((l) => { for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) v += e.value; }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(v), 300);
      });
      // The lightweight LazyCodeEditor wrapper is a route dependency, not Monaco.
      // Match the actual editor/API/worker chunks at the path boundary.
      const editorResources = js.filter(r => /\/(?:CodeEditor-|editor\.api|editor\.worker-|monaco)/i.test(new URL(r.name).pathname)).map(r => new URL(r.name).pathname);
      return { lcp: Math.round(lcp), dcl: Math.round(nav.domContentLoadedEventEnd), jsFiles: js.length, jsBytes: js.reduce((a, r) => a + (r.encodedBodySize || r.transferSize), 0), editorLoaded: editorResources.length > 0, editorResources, totalBytes: res.reduce((a, r) => a + (r.encodedBodySize || r.transferSize), 0) + (nav.encodedBodySize || 0), cls: Math.round(cls * 1000) / 1000 };
    });
    console.log(`PERF ${p} ${JSON.stringify(m)}`);
    expect(m.lcp, 'LCP must be observed, rather than an unsupported metric or timeout').toBeGreaterThan(0);
    expect(m.lcp).toBeLessThan(2500);
    expect(m.cls).toBeLessThan(0.1);
    expect(m.jsBytes, 'Initial transferred JavaScript budget: 512 KiB').toBeLessThan(512 * 1024);
    if (p === '/specifications' || p === '/code') {
      expect(m.editorLoaded, 'Editor must load only after a document/file is opened').toBe(false);
      await expect(page.locator('.monaco-editor'), 'No editor may mount on an unopened document/file route').toHaveCount(0);
    }
  });
}
