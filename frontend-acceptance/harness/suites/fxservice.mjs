// FX-SERVICE (v2 §6.3) with TRUSTED pointer input. Fixture: FX-SERVICE/atlas-ui-v1-fixture-r3 (labelled; proposed contract,
// reverse-engineered — NOT an approved DTO). Installed with addInitScript as a window.fetch wrapper on the REAL page, so the
// deployed bundle is exercised unmodified; only https://fixture.atlas.test/* is answered by the fixture.
// Expected client semantics (v2 §6.3, documented in the master prompt; see FND-006 for the open 4xx decision):
//   double activation => exactly 1 POST; Received/Accepted/Rejected/Effective shown as such; 4xx/5xx/netfail/timeout/
//   fingerprint mismatch after send => Unknown (no automatic resend); 401 => disconnect; expired session => disconnect;
//   observer audience cannot send commands; FND-005: no stale success toast after 401/expiry disconnect.
import { chromium } from 'playwright';
import { Recorder, writeJSON } from '../lib.mjs';
import { errorHooks } from './common.mjs';

const FIXTURE = (cfg) => `(() => {
  const cfg = ${JSON.stringify(cfg)};
  const B = 'https://fixture.atlas.test';
  const S = { scope: 'org:fx/ws:alpha', mode: cfg.mode, ttl: cfg.ttl || 3600e3, force401: false, created: Date.now() };
  const out = { posts: [], gets: [], ops: {} };
  window.__FX = { S, out };
  const modules = ['agents','resources','memory','workflow','execution','governance','gateway','collaboration','configuration','identity','tenancy','saas','desktop','observer'];
  const item = (m, i) => ({ id: m + '-' + i, name: 'FX ' + m + ' ' + i, revision: 3, scope: S.scope, observedAt: new Date(S.created - 6e4).toISOString(), status: 'Active', etag: '"' + m + '-' + i + '-r3"', fields: { owner: 'fx-user' },
    actions: [{ id: 'act-1', grant: m + '.write', label: 'FX action ' + m, href: B + '/v1/' + m + '/' + m + '-' + i + '/act-1', statusHref: B + '/v1/ops/{operationId}', effectHref: B + '/v1/effects/' + m + '-' + i, resourceId: m + '-' + i, expectedRevision: 3, inputs: [] }] });
  const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ofetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    init = init || {};
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (!url.startsWith(B)) return ofetch(input, init);
    const method = (init.method || (input && input.method) || 'GET').toUpperCase();
    const u = new URL(url);
    if (method === 'POST') {
      let body = {}; try { body = JSON.parse(init.body || '{}'); } catch (e) {}
      const h = new Headers(init.headers || {});
      out.posts.push({ t: Date.now(), path: u.pathname, idem: h.get('Idempotency-Key'), csrf: h.get('X-CSRF-Token') ? '[REDACTED]' : null, ifMatch: h.get('If-Match'), op: body.operationId, rev: body.expectedRevision, keys: Object.keys(body) });
      const m = S.mode;
      if (/^http\\d{3}$/.test(m)) return json({ error: m }, Number(m.slice(4)));
      if (m === 'netfailAfterSend') throw new TypeError('Failed to fetch');
      if (m === 'timeoutAfterSend') { await sleep(20000); throw new TypeError('network timeout'); }
      const stage = { effective: 'Effective', received: 'Received', accepted: 'Accepted', rejected: 'Rejected', mismatch: 'Effective' }[m] || 'Received';
      out.ops[body.operationId] = { fp: body.fingerprint, stage, rid: body.resourceId, rev: body.expectedRevision };
      out.lastByResource = out.lastByResource || {}; out.lastByResource[body.resourceId] = body.operationId;
      return json({ operationId: body.operationId, scope: S.scope, resourceId: body.resourceId, fingerprint: m === 'mismatch' ? 'deadbeef' : body.fingerprint, expectedRevision: body.expectedRevision, stage });
    }
    out.gets.push(u.pathname);
    if (S.force401) return json({ error: 'unauthorized' }, 401);
    if (Date.now() - S.created > S.ttl && u.pathname !== '/v1/capabilities') return json({ error: 'expired' }, 401);
    if (u.pathname === '/v1/capabilities') { const aud = u.searchParams.get('audience') || 'workspace'; return json({ protocol: 'atlas-ui/v1', audience: aud, scope: S.scope, serviceSessionHref: B + '/v1/session?audience=' + aud, modules: Object.fromEntries(modules.map(m => [m, { collectionHref: B + '/v1/' + m }])) }); }
    if (u.pathname === '/v1/session') { const aud = u.searchParams.get('audience') || 'workspace'; return json({ subject: 'fx-user@fixture', scope: S.scope, audience: aud, grants: aud === 'observer' ? [] : modules.map(m => m + '.write'), expiresAt: new Date(S.created + S.ttl).toISOString(), csrfToken: 'fx-csrf' }); }
    const mm = u.pathname.match(/^\\/v1\\/([a-z]+)$/);
    if (mm) return json({ items: [item(mm[1], 1), item(mm[1], 2)], complete: true, observedAt: new Date().toISOString() });
    const op = u.pathname.match(/^\\/v1\\/ops\\/(.+)$/);
    if (op) { const id = decodeURIComponent(op[1]); const o = out.ops[id]; if (!o) return json({ error: 'unknown op' }, 404); return json({ operationId: id, scope: S.scope, resourceId: o.rid, fingerprint: o.fp, expectedRevision: o.rev, stage: o.stage }); }
    const ef = u.pathname.match(/^\\/v1\\/effects\\/(.+)$/);
    if (ef) { const key = decodeURIComponent(ef[1]); const id = out.ops[key] ? key : (out.lastByResource || {})[key]; const o = out.ops[id]; if (!o) return json({ error: 'no effect' }, 404); return json({ operationId: id, scope: S.scope, resourceId: o.rid, fingerprint: S.mode === 'mismatch' ? 'deadbeef' : o.fp, revision: 4, evidenceId: 'fx-evidence-' + id.slice(0, 6), observedAt: new Date().toISOString() }); }
    return json({ error: 'not found' }, 404);
  };
})();`;

const STAGE_RE = /\b(Effective|Received|Accepted|Rejected|Unknown|NotSent|Sending|Prepared)\b/g;

async function scenario(browser, target, mode, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(FIXTURE({ mode, ttl: opts.ttl }));
  const page = await ctx.newPage();
  const errors = []; errorHooks(page, errors);
  const r = { mode, steps: {}, errors };
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert],[aria-live],.toast,.notice')].map(e => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 6));
  try {
    await page.goto(`${target}/#connection`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#service-endpoint');
    if (opts.audience) await page.getByLabel('Audience').selectOption(opts.audience);
    await page.fill('#service-endpoint', 'https://fixture.atlas.test');
    await page.getByRole('button', { name: 'Connect & inspect authority' }).click();
    r.steps.connected = await page.waitForFunction(() => /fx-user@fixture/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true, () => false);
    r.steps.connectToasts = await toasts();
    if (opts.expire) {
      await page.waitForTimeout(opts.ttl + 1500);
      await page.evaluate(() => { location.hash = 'resources?authority=service'; });
      await page.waitForTimeout(1500);
      const refresh = page.getByRole('button', { name: /Load \/ refresh service records/ });
      r.steps.refreshEnabled = await refresh.count() ? await refresh.first().isEnabled() : null;
      if (r.steps.refreshEnabled) { await refresh.first().click(); await page.waitForTimeout(1500); }
      r.steps.getsAfterExpiry = await page.evaluate(() => window.__FX.out.gets.slice(-4));
      r.steps.afterExpiry = { connectedText: await page.evaluate(() => /fx-user@fixture/.test(document.body.innerText)), header: await page.evaluate(() => (document.querySelector('header')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200)), toasts: await toasts() };
      return r;
    }
    await page.evaluate(() => { location.hash = 'agents?authority=service'; });
    await page.waitForFunction(() => /FX agents 1/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    const action = page.getByRole('button', { name: 'FX action agents' });
    r.steps.actionVisible = await action.count() > 0;
    r.steps.actionDisabled = r.steps.actionVisible ? await action.first().isDisabled() : null;
    if (!r.steps.actionVisible || r.steps.actionDisabled) { r.steps.mainText = (await page.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ').slice(0, 600); }
    if (r.steps.actionVisible && !r.steps.actionDisabled) {
      await action.first().click();
      const send = page.getByRole('button', { name: /^Send / });
      r.steps.confirmShown = await send.count() > 0;
      if (r.steps.confirmShown) {
        await send.first().dblclick();                         // trusted double activation
        await page.waitForTimeout(mode === 'timeoutAfterSend' ? 24000 : 2500);
        if (await send.count() && await send.first().isEnabled().catch(() => false)) { await send.first().click().catch(() => {}); await page.waitForTimeout(1500); r.steps.thirdClickAttempted = true; }
      }
      r.steps.posts = await page.evaluate(() => window.__FX.out.posts.length);
      r.steps.postDetail = await page.evaluate(() => window.__FX.out.posts.map(p => ({ idem: !!p.idem, csrf: p.csrf, ifMatch: p.ifMatch, rev: p.rev, keys: p.keys })));
      r.steps.dialogText = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],[aria-modal=true]')].map(d => d.innerText.replace(/\s+/g, ' ').slice(0, 400)));
      r.steps.stagesOnPage = [...new Set(((await page.evaluate(() => document.body.innerText)).match(STAGE_RE) || []))];
      r.steps.toasts = await toasts();
      // close dialog if still open, then look at the journal
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { location.hash = 'connection'; });
      await page.waitForTimeout(600);
      const rf = page.getByRole('button', { name: 'Refresh local journal' });
      if (await rf.count()) { await rf.click(); await page.waitForTimeout(500); }
      r.steps.journal = await page.evaluate(() => [...document.querySelectorAll('main table tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').slice(0, 300)).slice(0, 5));
    }
    if (opts.then401) {
      await page.evaluate(() => { window.__FX.S.force401 = true; location.hash = 'memory?authority=service'; });
      await page.waitForTimeout(1500);
      const refresh = page.getByRole('button', { name: /Load \/ refresh service records/ });
      r.steps.refreshEnabled401 = await refresh.count() ? await refresh.first().isEnabled() : null;
      if (r.steps.refreshEnabled401) { await refresh.first().click(); await page.waitForTimeout(1500); }
      r.steps.gets401 = await page.evaluate(() => window.__FX.out.gets.slice(-4));
      r.steps.after401 = { connectedText: await page.evaluate(() => /fx-user@fixture/.test(document.body.innerText)), header: await page.evaluate(() => (document.querySelector('header')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200)), toasts: await toasts() };
    }
  } catch (e) { r.error = String(e).slice(0, 400); }
  finally { await ctx.close(); }
  return r;
}

export default async function ({ runDir, req, target }) {
  const rec = new Recorder(runDir, 'fxservice');
  const browser = await chromium.launch();
  const res = { fixture_id: 'FX-SERVICE/atlas-ui-v1-fixture-r3', browserVersion: browser.version(), scenarios: [] };
  const modes = req.fx_modes || ['effective', 'received', 'accepted', 'rejected', 'http401', 'http403', 'http409', 'http422', 'http500', 'netfailAfterSend', 'timeoutAfterSend', 'mismatch'];
  for (const m of modes) res.scenarios.push(await scenario(browser, target, m, { then401: m === 'effective' }));
  res.scenarios.push(await scenario(browser, target, 'effective', { expire: true, ttl: 4000 }));
  res.scenarios.at(-1).mode = 'sessionExpiry';
  res.scenarios.push(await scenario(browser, target, 'effective', { audience: 'observer' }));
  res.scenarios.at(-1).mode = 'observerAudience';
  await browser.close();
  writeJSON(rec.evidenceFile('fxservice-results.json', { evidence_type: 'fixture-scenarios', fixture: res.fixture_id, input_mode: 'trusted-input' }), res);
  rec.save();
  return Object.fromEntries(res.scenarios.map(s => [s.mode, `posts=${s.steps.posts ?? '-'} stages=${(s.steps.stagesOnPage || []).join('/')} ${s.error ? 'ERR' : ''}`]));
}
