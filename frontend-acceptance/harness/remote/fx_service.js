// FX-SERVICE-001 / FX-SERVICE-FND-005 — UNTESTED DRAFT written in run 2 (quota exhausted before execution).
// Load on a same-origin 404 path (e.g. /harness-blank). Installs a fetch fixture for https://fixture.atlas.test/,
// injects the REAL deployed bundle, connects via the Connection page and records stage/toast behaviour.
// Contract follows v2 §6.3 (atlas-ui/v1 as reverse-engineered in run 1; NOT an approved DTO). Every response is labelled fixture.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.style.display = 'none'; document.documentElement.appendChild(pre);
  const out = { fixture: 'FX-SERVICE/atlas-ui-v1-fixture-r2', posts: [], gets: [], steps: [], errs: [] };
  const flush = () => { pre.textContent = JSON.stringify(out); };
  addEventListener('error', e => out.errs.push(String(e.message)));
  addEventListener('unhandledrejection', e => out.errs.push('rej ' + String(e.reason).slice(0, 120)));
  const B = 'https://fixture.atlas.test';
  const now = Date.now();
  const S = { scope: 'org:fx/ws:alpha', mode: window.__FX_MODE || 'effective', ttl: window.__FX_TTL || 3600e3, force401: false };
  const modules = ['agents', 'resources', 'memory', 'workflow', 'execution', 'governance', 'gateway', 'collaboration', 'configuration', 'identity', 'tenancy', 'saas', 'desktop', 'observer'];
  const item = (m, i) => ({ id: `${m}-${i}`, name: `FX ${m} ${i}`, revision: 3, scope: S.scope, observedAt: new Date(now - 6e4).toISOString(), status: 'Active', etag: `"${m}-${i}-r3"`, fields: { owner: 'fx-user' },
    actions: [{ id: 'act-1', grant: `${m}.write`, label: `FX action ${m}`, href: `${B}/v1/${m}/${m}-${i}/act-1`, statusHref: `${B}/v1/ops/{operationId}`, effectHref: `${B}/v1/${m}/${m}-${i}/effect/{operationId}`, resourceId: `${m}-${i}`, expectedRevision: 3, inputs: [] }] });
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  const ofetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith(B)) return ofetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    const u = new URL(url);
    if (S.force401 && method === 'GET') return json({ error: 'unauthorized' }, 401);
    if (method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      const h = new Headers(init.headers || {});
      out.posts.push({ path: u.pathname, idem: h.get('Idempotency-Key'), csrf: h.get('X-CSRF-Token') ? '[REDACTED]' : null, ifMatch: h.get('If-Match'), op: body.operationId, rev: body.expectedRevision });
      flush();
      const m = S.mode;
      if (/^http(\d{3})$/.test(m)) return json({ error: m }, Number(m.slice(4)));
      if (m === 'netfailAfterSend') throw new TypeError('Failed to fetch');
      if (m === 'timeoutAfterSend') { await sleep(20000); throw new TypeError('timeout'); }
      const stage = { effective: 'Effective', received: 'Received', accepted: 'Accepted', rejected: 'Rejected', mismatch: 'Effective' }[m] || 'Received';
      return json({ operationId: body.operationId, scope: S.scope, resourceId: body.resourceId, fingerprint: m === 'mismatch' ? 'deadbeef' : body.fingerprint, expectedRevision: body.expectedRevision, stage });
    }
    out.gets.push(u.pathname + u.search);
    if (u.pathname === '/v1/capabilities') return json({ protocol: 'atlas-ui/v1', audience: u.searchParams.get('audience') || 'workspace', scope: S.scope, serviceSessionHref: `${B}/v1/session`, modules: Object.fromEntries(modules.map(m => [m, { collectionHref: `${B}/v1/${m}` }])) });
    if (u.pathname === '/v1/session') return json({ subject: 'fx-user@fixture', scope: S.scope, audience: 'workspace', grants: modules.map(m => `${m}.write`), expiresAt: new Date(now + S.ttl).toISOString(), csrfToken: 'fx-csrf' });
    const mm = u.pathname.match(/^\/v1\/([a-z]+)$/);
    if (mm) return json({ items: [item(mm[1], 1), item(mm[1], 2)], complete: true, observedAt: new Date().toISOString() });
    const ef = u.pathname.match(/^\/v1\/([a-z]+)\/([^/]+)\/effect\/(.+)$/);
    if (ef) { const p = out.posts[out.posts.length - 1] || {}; return json({ operationId: decodeURIComponent(ef[3]), scope: S.scope, resourceId: ef[2], fingerprint: p.fp, revision: 4, evidenceId: 'fx-evidence-1', observedAt: new Date().toISOString() }); }
    return json({ error: 'not found' }, 404);
  };
  // inject the real bundle (same files as index.html of release a8b5bc3a)
  document.documentElement.dataset.theme = 'dark';
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/assets/index-CGLbd-qV.css"><link rel="modulepreload" href="/assets/ui-BHoQ7tHD.js">');
  document.body.insertAdjacentHTML('beforeend', '<div id="root"></div>');
  history.replaceState(null, '', location.pathname + '#connection');
  const s = document.createElement('script'); s.type = 'module'; s.src = '/assets/index-CNIcNnJO.js'; document.body.appendChild(s);
  const waitFor = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(60); } return null; };
  const setVal = (el, v) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  const btn = re => [...document.querySelectorAll('button')].find(b => re.test(b.textContent || ''));
  const toasts = () => [...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 6);
  const ep = await waitFor(() => document.getElementById('service-endpoint'));
  out.steps.push(['bundle_rendered', !!ep]); flush();
  if (!ep) { out.complete = 1; flush(); return; }
  setVal(ep, B);
  const c = btn(/Connect & inspect authority/); c && c.click();
  const sess = await waitFor(() => /fx-user@fixture/.test(document.body.innerText), 6000);
  out.steps.push(['connected', !!sess, toasts()]); flush();
  // double activation of the first service action on #agents
  location.hash = 'agents?authority=service'; await sleep(1200);
  const a = btn(/FX action agents/);
  out.steps.push(['action_visible', !!a]);
  if (a) { a.click(); a.click(); await sleep(1500); }
  out.steps.push(['after_double_click', out.posts.length, toasts(), document.body.innerText.match(/Effective|Received|Accepted|Rejected|Unknown/g)?.slice(0, 6) || []]); flush();
  // FND-005: force 401 on next GET and observe toast region
  S.force401 = true; location.hash = 'connection'; await sleep(300);
  const r = btn(/Refresh local journal/); r && r.click();
  location.hash = 'agents?authority=service'; await sleep(1500);
  out.steps.push(['after_401', /fx-user@fixture/.test(document.body.innerText), toasts()]);
  out.complete = 1; flush();
  const d = document.createElement('i'); d.id = '__atlas_done'; document.documentElement.appendChild(d);
})();
