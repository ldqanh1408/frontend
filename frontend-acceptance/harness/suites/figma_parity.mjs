// FIGMA-PARITY (FE-01 / FE-06 design parity). Oracle = Figma file 0md9BEFI1rU0aRAvf98TWO, pages "01 · Current UI · Dark" and
// "02 · Current UI · Light": one frame "Atlas/<Theme>/<route>" per deployed hash route (18). The structural copy of each frame
// (page title, purpose line, navigation IA, controls/tabs/sections) was transcribed read-only into harness/data/figma-oracle.json
// BEFORE this run (work/figma_data.py); illustrative sample content of the frames is excluded.
// Expected (fixed before run): for every route, on the deployed UI at 1440x1000 in both themes:
//   h1 == Figma title; Figma purpose line present; every Figma control/tab/section label present as visible text
//   (exact line, or contained in a longer visible label = EQUIVALENT); sidebar IA == Figma NAV (group headings, labels, order).
// The deployed corpus for a route is the union of: default view, the "Service records" tab (when present) and, for authoring
// modules, the editor after "Create local definition" (synthetic local draft in an ephemeral browser profile; no network write).
// Trusted pointer input only. Screenshots are viewport JPEGs of each captured view.
import * as pw from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, writeJSON, ROOT } from '../lib.mjs';
import { EXP, waitH1, settle, setTheme, errorHooks } from './common.mjs';

const OR = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness', 'data', 'figma-oracle.json'), 'utf8'));
const norm = s => String(s || '').normalize('NFKC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

const CORPUS = () => {
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const lines = new Set();
  for (const l of document.body.innerText.split('\n')) if (l.trim()) lines.add(l.trim());
  for (const e of document.querySelectorAll('button,a,[role=tab],[role=button],summary,label,h1,h2,h3,legend,th,option,strong,small,span,p'))
    if (vis(e) || e.tagName === 'OPTION') { const t = (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); if (t && t.length < 300) lines.add(t); const a = e.getAttribute('aria-label') || e.getAttribute('title'); if (a) lines.add(a.trim()); }
  for (const e of document.querySelectorAll('input[placeholder],textarea[placeholder]')) lines.add(e.placeholder.trim());
  const h1 = document.querySelector('main h1');
  const p = h1 && (h1.parentElement.querySelector('p') || h1.nextElementSibling);
  const nav = [];
  const aside = document.querySelector('aside nav') || document.querySelector('nav');
  if (aside) for (const e of aside.querySelectorAll('h2,h3,a')) nav.push({ tag: e.tagName, text: e.textContent.replace(/\s+/g, ' ').trim(), href: e.getAttribute('href') });
  const cs = e => e ? (s => ({ bg: s.backgroundColor, fg: s.color, font: s.fontFamily.split(',')[0] }))(getComputedStyle(e)) : null;
  return { lines: [...lines], h1: h1 ? h1.textContent.trim() : null, purpose: p ? p.textContent.replace(/\s+/g, ' ').trim() : null, nav,
    theme: document.documentElement.dataset.theme || null,
    colors: { body: cs(document.body), header: cs(document.querySelector('header')), aside: cs(document.querySelector('aside')), main: cs(document.querySelector('main')), h1: cs(h1) } };
};

function match(expect, lines) {
  const want = norm(expect);
  const L = lines.map(norm);
  if (want.endsWith('…')) { const pre = want.slice(0, -1); return L.some(l => l.startsWith(pre)) ? 'EXACT' : (L.some(l => l.includes(pre)) ? 'EQUIVALENT' : 'MISSING'); }
  if (L.includes(want)) return 'EXACT';
  const re = new RegExp('(^|[^a-z0-9])' + want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])');
  if (L.some(l => re.test(l))) return 'EQUIVALENT';
  const toks = want.split(/[^a-z0-9&]+/).filter(t => t.length > 2);
  if (toks.length && L.some(l => toks.every(t => l.includes(t)))) return 'SIMILAR';
  return 'MISSING';
}

export default async function ({ runDir, req, target }) {
  const rec = new Recorder(runDir, 'figma_parity');
  const browser = await pw.chromium.launch();
  const out = { browserVersion: browser.version(), routes: {}, requests_non_get: [] };
  const routes = Object.keys(OR.module_frames);
  for (const theme of req.parity_themes || ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage(); const errs = []; errorHooks(page, errs);
    page.on('request', r => { if (r.method() !== 'GET' && r.url().startsWith(target)) out.requests_non_get.push({ m: r.method(), u: r.url() }); });
    await page.goto(`${target}/#home`, { waitUntil: 'networkidle' }); await waitH1(page, EXP.home);
    const got = await setTheme(page, theme);
    for (const r of routes) {
      await page.evaluate(h => { location.hash = h; }, r); await waitH1(page, EXP[r]); await settle(page); await page.waitForTimeout(250);
      const views = [];
      const snap = async (name) => {
        const c = await page.evaluate(CORPUS);
        const shot = rec.evidenceFile(`${theme}/${r}--${name}.jpg`, { evidence_type: 'screenshot', route: r, theme, view: name, viewport: '1440x1000' });
        await page.screenshot({ path: shot, type: 'jpeg', quality: 70 });
        views.push({ name, ...c, screenshot: path.relative(ROOT, shot) });
      };
      await snap('default');
      const svc = page.getByRole('tab', { name: 'Service records' });
      if (await svc.count()) { await svc.first().click(); await settle(page); await page.waitForTimeout(250); await snap('service-records');
        const defs = page.getByRole('tab', { name: 'Definitions' }); if (await defs.count()) { await defs.first().click(); await settle(page); } }
      const create = page.getByRole('button', { name: 'Create local definition' });
      if (await create.count()) { await create.first().click(); await page.waitForTimeout(800); await settle(page); await snap('local-draft-editor'); }
      const lines = [...new Set(views.flatMap(v => v.lines))];
      const ex = OR.module_expect[r];
      const controls = ex.controls.map(c => ({ figma: c, result: match(c, lines) }));
      const h1 = views[0].h1;
      const purposeRes = match(ex.purpose, lines);
      out.routes[`${theme}:${r}`] = { route: r, theme, theme_applied: got, figma_frame: OR.module_frames[r][theme === 'dark' ? 0 : 1],
        h1, figma_title: ex.title, title_result: norm(h1) === norm(ex.title) ? 'EXACT' : match(ex.title, [h1 || '']),
        purpose_deployed: views[0].purpose, figma_purpose: ex.purpose, purpose_result: purposeRes, controls,
        nav: views[0].nav, colors: views[0].colors, views: views.map(v => ({ name: v.name, screenshot: v.screenshot, lines: v.lines.length })), lines_sample: lines.slice(0, 400) };
    }
    out.errors = (out.errors || []).concat(errs);
    await ctx.close();
  }
  await browser.close();
  // Navigation IA (dark corpus of #home).
  const navD = out.routes['dark:home'] ? out.routes['dark:home'].nav : [];
  const figNav = OR.nav.flatMap(([g, items]) => [{ tag: 'H2', text: g }, ...items.map(t => ({ tag: 'A', text: t, href: '#' + OR.nav_route[t] }))]);
  const navCmp = figNav.map(f => {
    const d = f.tag === 'A' ? navD.find(n => n.tag === 'A' && n.href === f.href) : navD.find(n => n.tag !== 'A' && norm(n.text) === norm(f.text));
    return { figma: f.text, kind: f.tag === 'A' ? 'link' : 'group', href: f.href || null, deployed: d ? d.text : null, result: d ? (norm(d.text) === norm(f.text) ? 'EXACT' : 'DIFFERENT_LABEL') : 'MISSING' };
  });
  const order = { figma: figNav.filter(f => f.tag === 'A').map(f => f.href), deployed: navD.filter(n => n.tag === 'A' && /^#[a-z]+$/.test(n.href || '')).map(n => n.href) };
  out.nav_compare = { items: navCmp, order, same_order: JSON.stringify(order.figma) === JSON.stringify(order.deployed), deployed_groups: navD.filter(n => n.tag !== 'A').map(n => n.text) };
  const navBad = navCmp.filter(n => n.result !== 'EXACT');
  rec.add({ case_id: 'FIGMA-PARITY-NAV', gate: 'FE-01', title: 'Sidebar IA vs Figma Current UI navigation (01/02 · Current UI, every module frame)',
    steps: 'Load #home 1440x1000; read aside nav headings and links; compare with Figma NAV groups, labels and order',
    expected: '3 groups BUILD / KNOWLEDGE & SERVICES / ADMINISTRATION and 18 link labels identical to Figma, same order',
    actual: `${navCmp.length - navBad.length}/${navCmp.length} exact; order ${out.nav_compare.same_order ? 'same' : 'different'}; deployed groups: ${out.nav_compare.deployed_groups.join(' / ')}; mismatches: ${navBad.map(n => `${n.figma}→${n.deployed || 'missing'}`).join('; ')}`.slice(0, 1500),
    result: navBad.length || !out.nav_compare.same_order ? 'FAIL' : 'PASS', input_mode: 'trusted-input', browser: `chromium ${out.browserVersion}` });
  for (const r of routes) for (const theme of req.parity_themes || ['dark', 'light']) {
    const x = out.routes[`${theme}:${r}`]; if (!x) continue;
    const miss = x.controls.filter(c => c.result === 'MISSING' || c.result === 'SIMILAR');
    const ok = x.title_result === 'EXACT' && ['EXACT', 'EQUIVALENT'].includes(x.purpose_result) && !miss.length;
    rec.add({ case_id: `FIGMA-PARITY-${r.toUpperCase()}-${theme.toUpperCase()}`, gate: 'FE-01', title: `#${r} vs Figma frame ${x.figma_frame} (Atlas/${theme === 'dark' ? 'Dark' : 'Light'}/${r})`,
      steps: `Load #${r} 1440x1000 theme=${theme}; capture default view${r && OR.service_tab_routes.includes(r) ? ' + Service records tab' : ''} + local draft editor when offered; compare title, purpose and ${x.controls.length} Figma controls`,
      expected: `h1 "${x.figma_title}"; purpose "${x.figma_purpose}"; all ${x.controls.length} Figma controls visible`,
      actual: `h1 "${x.h1}" (${x.title_result}); purpose ${x.purpose_result}: "${(x.purpose_deployed || '').slice(0, 140)}"; controls exact ${x.controls.filter(c => c.result === 'EXACT').length}, equivalent ${x.controls.filter(c => c.result === 'EQUIVALENT').length}, similar ${x.controls.filter(c => c.result === 'SIMILAR').length}, missing ${x.controls.filter(c => c.result === 'MISSING').length}: ${miss.map(c => c.figma).join(' | ')}`.slice(0, 1800),
      result: ok ? 'PASS' : 'FAIL', input_mode: 'trusted-input', browser: `chromium ${out.browserVersion}`, evidence: x.views.map(v => v.screenshot).join(';') });
  }
  rec.add({ case_id: 'FIGMA-PARITY-NOWRITE', gate: 'FE-04', title: 'Parity run issued no non-GET request to the target origin', steps: 'Count non-GET requests to target during the suite',
    expected: '0', actual: String(out.requests_non_get.length), result: out.requests_non_get.length ? 'FAIL' : 'PASS', input_mode: 'observation', browser: `chromium ${out.browserVersion}` });
  writeJSON(rec.evidenceFile('figma-parity.json', { evidence_type: 'figma-parity', oracle: 'figma 01/02 Current UI' }), out);
  rec.save();
  return { routes: Object.keys(out.routes).length, pass: rec.cases.filter(c => c.result === 'PASS').length, fail: rec.cases.filter(c => c.result === 'FAIL').length };
}
