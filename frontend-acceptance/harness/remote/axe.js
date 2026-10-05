// A11Y-AXE-001/002: requires axe-core injected first (addScriptTag url https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js).
// window.__AXE_THEME = 'dark' | 'light' may be set by a preceding addScriptTag.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const EXP = {home:'Build with a clear trail.',specifications:'Specifications',code:'Code intelligence',agents:'Agents',resources:'Resources',memory:'Memory',workflow:'Workflow',execution:'Execution',governance:'Delivery & acceptance',gateway:'AI gateway',collaboration:'Collaboration',configuration:'Configuration',identity:'Identity & access',tenancy:'Organization & projects',saas:'Usage & billing',desktop:'Desktop companion',observer:'Observer',connection:'Connection & operations'};
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.style.display = 'none'; document.body.appendChild(pre);
  const out = { axe: window.axe ? axe.version : null, theme: null, routes: {}, rules: {} };
  const flush = () => { pre.textContent = JSON.stringify(out); };
  const want = window.__AXE_THEME || 'dark';
  if (document.documentElement.dataset.theme !== want) { const b = [...document.querySelectorAll('button')].find(b => /switch display theme/i.test(b.getAttribute('aria-label') || b.getAttribute('title') || '')); if (b) b.click(); await sleep(400); }
  out.theme = document.documentElement.dataset.theme; flush();
  for (const [r, h] of Object.entries(EXP)) {
    location.hash = r;
    const t = Date.now(); while (Date.now() - t < 3000) { const e = document.querySelector('main h1'); if (e && e.textContent.trim() === h) break; await sleep(40); }
    await sleep(250);
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, exclude: [['#__atlas_out']] });
    out.routes[r] = { v: res.violations.map(v => [v.id, v.impact, v.nodes.length]), inc: res.incomplete.length, pass: res.passes.length };
    for (const v of res.violations) { out.rules[v.id] = out.rules[v.id] || { impact: v.impact, help: v.help, sample: v.nodes[0] && v.nodes[0].target.join(' '), routes: [] }; out.rules[v.id].routes.push(r); }
    flush();
  }
  out.complete = 1; flush();
  const d = document.createElement('i'); d.id = '__atlas_done'; document.body.appendChild(d);
})();
