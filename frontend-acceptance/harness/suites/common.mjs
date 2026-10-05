// Shared helpers for the Playwright suites (AUDIT_ONLY).
export const EXP = {
  home: 'Build with a clear trail.', specifications: 'Specifications', code: 'Code intelligence', agents: 'Agents', resources: 'Resources',
  memory: 'Memory', workflow: 'Workflow', execution: 'Execution', governance: 'Delivery & acceptance', gateway: 'AI gateway',
  collaboration: 'Collaboration', configuration: 'Configuration', identity: 'Identity & access', tenancy: 'Organization & projects',
  saas: 'Usage & billing', desktop: 'Desktop companion', observer: 'Observer', connection: 'Connection & operations',
};

export async function waitH1(page, want, timeout = 8000) {
  try {
    await page.waitForFunction(w => { const h = document.querySelector('main h1'); return h && (!w || h.textContent.trim() === w); }, want, { timeout });
    return true;
  } catch { return false; }
}

export async function settle(page) {
  await page.waitForFunction(() => {
    const L = (document.querySelector('main') || document.body).innerText.length;
    const prev = window.__atlasLastLen; window.__atlasLastLen = L;
    return prev === L;
  }, null, { polling: 150, timeout: 4000 }).catch(() => {});
}

// Switch theme through the app's own header button (pointer click = trusted in Playwright).
export async function setTheme(page, theme) {
  const cur = await page.evaluate(() => document.documentElement.dataset.theme);
  if (cur === theme) return theme;
  await page.locator('header button[title="Switch display theme"], header button[aria-label="Switch display theme"]').first().click();
  await page.waitForTimeout(300);
  return page.evaluate(() => document.documentElement.dataset.theme);
}

export function pct(arr, p) {
  const a = arr.filter(v => typeof v === 'number').sort((x, y) => x - y);
  if (!a.length) return null;
  const i = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return a[i];
}

export function errorHooks(page, sink) {
  page.on('pageerror', e => sink.push({ type: 'pageerror', msg: String(e).slice(0, 300), url: page.url() }));
  page.on('console', m => { if (m.type() === 'error') sink.push({ type: 'console.error', msg: m.text().slice(0, 300), url: page.url() }); });
}
