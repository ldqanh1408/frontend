// DEF-FIGMA: retest FND-004 and the field contract of all 49 definition types. Oracle = the 49 Figma frames
// "<type> · unified fields" (01 · Current UI · Dark), transcribed read-only into harness/data/figma-oracle.json before this run:
// per type title, module, field count, groups (order, names, counts) and per field key, label, required marker, unit/range,
// options and hint. Deployed DOM contract (observed): each control has id "definition-<key>", its <label class=field> span holds
// the label (+ " *" when required) and <small id="definition-<key>-hint"> the hint or the validation error.
// Expected (fixed before run), per type:
//   DEF-NAV    the type is reachable from its module UI (Definitions tab → "Definition type" select) and h2 == Figma title;
//   DEF-CREATE "Create local definition" (trusted click, default values) opens the editor without an error  (FND-004);
//   DEF-COUNT  "<n> fields" badge == Figma field count; section nav groups/counts == Figma groups/counts (same order);
//   DEF-FIELDS every Figma field key present with identical label, required flag, unit, range and options; no extra keys.
// Synthetic data: local drafts named "<title> <uuid8>" are created in an ephemeral Chromium profile (IndexedDB of a context that
// is closed after each module); no request other than GET reaches the target origin (asserted).
import * as pw from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, writeJSON, ROOT } from '../lib.mjs';
import { EXP, waitH1, settle, errorHooks } from './common.mjs';

const OR = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness', 'data', 'figma-oracle.json'), 'utf8'));
const norm = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();

const HEADER = () => {
  const main = document.querySelector('main');
  const h2s = [...main.querySelectorAll('h2')].map(h => h.textContent.trim());
  const badge = [...main.querySelectorAll('*')].map(e => e.childElementCount === 0 ? e.textContent.trim() : '').find(t => /^\d+ fields/.test(t)) || null;
  const secNav = [...main.querySelectorAll('nav[aria-label="Definition sections"] a')].map(a => a.textContent.replace(/\s+/g, ' ').trim());
  const sel = main.querySelector('select[aria-label="Definition type"]') || [...main.querySelectorAll('select')].find(s => (s.labels && [...s.labels].some(l => /Definition type/.test(l.textContent))));
  return { h2s, badge, secNav, typeOptions: sel ? [...sel.options].map(o => o.textContent.trim()) : null, typeSelected: sel ? sel.options[sel.selectedIndex]?.textContent.trim() : null, hash: location.hash };
};
const EDITOR = () => {
  const main = document.querySelector('main');
  const ctl = [...main.querySelectorAll('input[id^="definition-"],select[id^="definition-"],textarea[id^="definition-"]')];
  const groupOf = el => { let g = el.closest('[id^="definition-group-"]'); if (!g) return null; const h = g.querySelector('h2,h3,legend,strong'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : g.id; };
  const fields = ctl.map(el => {
    const lab = el.closest('label.field') || main.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    const span = lab && lab.querySelector('span');
    const hint = document.getElementById(el.id + '-hint');
    return { key: el.id.slice('definition-'.length), tag: el.tagName, type: el.type || null, label: span ? span.textContent.replace(/\s+/g, ' ').trim() : null,
      required: !!el.required || (span ? /\*\s*$/.test(span.textContent) : false), min: el.getAttribute('min'), max: el.getAttribute('max'),
      options: el.tagName === 'SELECT' ? [...el.options].map(o => o.textContent.trim()) : null, value: el.tagName === 'SELECT' ? el.value : (el.value || '').slice(0, 80),
      hint: hint ? hint.textContent.replace(/\s+/g, ' ').trim() : null, hintIsError: hint ? hint.classList.contains('error-text') : false, group: groupOf(el) };
  });
  const status = [...main.querySelectorAll('.editor-status span, footer span')].map(s => s.textContent.trim()).filter(Boolean);
  const notices = [...document.querySelectorAll('[role=alert],[role=status],.notice,.toast')].map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 10);
  const buttons = [...main.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.getAttribute('aria-label') || b.textContent).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const validation = [...main.querySelectorAll('*')].map(e => e.childElementCount === 0 ? e.textContent.trim() : '').find(t => /^(Local field checks passed|Complete validation not passed)$/.test(t)) || null;
  return { fields, status, notices, buttons: [...new Set(buttons)], validation, hash: location.hash };
};

function compareFields(t, fields) {
  const fig = t.groups.flatMap(g => g.fields.map(f => ({ ...f, group: g.group })));
  const byKey = Object.fromEntries(fields.map(f => [f.key, f]));
  const diffs = [];
  for (const f of fig) {
    const d = byKey[f.key];
    if (!d) { diffs.push({ key: f.key, issue: 'MISSING_FIELD', figma: f.label }); continue; }
    const figLabel = f.label.replace(/ \*$/, ''), depLabel = (d.label || '').replace(/\s*\*$/, '');
    if (norm(figLabel) !== norm(depLabel)) diffs.push({ key: f.key, issue: 'LABEL', figma: figLabel, deployed: depLabel });
    if (!!f.required !== !!d.required) diffs.push({ key: f.key, issue: 'REQUIRED', figma: f.required, deployed: d.required });
    if (f.hint.startsWith('U:')) {
      const [, unit, rng] = f.hint.split(':'); const [lo, hi] = rng.split('–');
      if (!(d.hint || '').includes('Unit: ' + unit)) diffs.push({ key: f.key, issue: 'UNIT', figma: unit, deployed: d.hint });
      if (d.min !== null && d.min !== lo || d.max !== null && d.max !== hi) diffs.push({ key: f.key, issue: 'RANGE', figma: rng, deployed: `${d.min}–${d.max}` });
      if (d.min === null && d.max === null) diffs.push({ key: f.key, issue: 'RANGE_NOT_ENFORCED_IN_DOM', figma: rng, deployed: null });
    }
    if (f.hint.startsWith('O:')) {
      const want = f.hint.slice(2).split(', ').map(norm);
      const got = (d.options || []).filter(o => o !== 'Not selected').map(norm);
      if (JSON.stringify(want) !== JSON.stringify(got)) diffs.push({ key: f.key, issue: 'OPTIONS', figma: want.join(','), deployed: got.join(',') });
    }
    if (norm(d.group || '') && norm(d.group) !== norm(f.group) && !norm(d.group).startsWith(norm(f.group))) diffs.push({ key: f.key, issue: 'GROUP', figma: f.group, deployed: d.group });
  }
  const figKeys = new Set(fig.map(f => f.key));
  for (const d of fields) if (!figKeys.has(d.key) && !/^\$|^-/.test(d.key) && d.key !== '-name' && d.key !== 'name') diffs.push({ key: d.key, issue: 'EXTRA_FIELD', deployed: d.label });
  return diffs;
}

export default async function ({ runDir, req, target }) {
  const rec = new Recorder(runDir, 'definitions');
  const browser = await pw.chromium.launch();
  const out = { browserVersion: browser.version(), types: [], nonGet: [] };
  const byRoute = {};
  for (const t of OR.definitions) (byRoute[t.route] = byRoute[t.route] || []).push(t);
  for (const [route, types] of Object.entries(byRoute)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage(); const errs = []; errorHooks(page, errs);
    page.on('request', r => { if (r.method() !== 'GET' && r.url().startsWith(target)) out.nonGet.push({ m: r.method(), u: r.url() }); });
    await page.goto(`${target}/#${route}`, { waitUntil: 'networkidle' }); await waitH1(page, EXP[route]); await settle(page);
    for (const t of types) {
      const r = { title: t.title, route, figma_frame: t.figma_dark, schema: t.schema_label, nav: null };
      try {
        await page.evaluate(h => { location.hash = h; }, route); await waitH1(page, EXP[route]); await settle(page);
        const defTab = page.getByRole('tab', { name: 'Definitions' });
        if (await defTab.count()) { await defTab.first().click(); await settle(page); }
        const sel = page.getByRole('combobox', { name: 'Definition type' });
        if (await sel.count()) {
          r.nav = 'module Definitions tab → Definition type select';
          const opts = await sel.first().locator('option').allTextContents();
          r.module_type_options = opts.map(s => s.trim());
          if (r.module_type_options.includes(t.title)) { await sel.first().selectOption({ label: t.title }); await settle(page); }
          else r.nav_issue = 'type not offered in the module select';
        } else r.nav_issue = 'no Definition type select on module route';
        if (r.nav_issue) { // fall back to the deployed deep link used by the search palette
          await page.evaluate(h => { location.hash = h; }, `${route}?authority=definitions&schema=${encodeURIComponent(t.schema_label)}`); await settle(page); await page.waitForTimeout(300);
          r.nav = (r.nav ? r.nav + '; ' : '') + 'fallback deep link ?authority=definitions&schema=' + t.schema_label;
        }
        r.header = await page.evaluate(HEADER);
        const create = page.getByRole('button', { name: 'Create local definition' });
        r.create_button = await create.count();
        if (r.create_button) {
          await create.first().click();
          await page.waitForFunction(() => document.querySelector('main [id^="definition-"]:is(input,select,textarea)') || document.querySelector('[role=alert],.notice.danger,.toast'), null, { timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(400);
        }
        r.editor = await page.evaluate(EDITOR);
        r.header_after = await page.evaluate(HEADER);
        const shot = rec.evidenceFile(`shots/${t.schema_label}.jpg`, { evidence_type: 'screenshot', type: t.title });
        await page.screenshot({ path: shot, type: 'jpeg', quality: 60, fullPage: true });
        r.screenshot = path.relative(ROOT, shot);
      } catch (e) { r.error = String(e).slice(0, 500); }
      r.errors = errs.splice(0);
      out.types.push(r);
      // ---- cases
      const h = r.header || {}; const ed = r.editor || { fields: [], notices: [] };
      const created = ed.fields.length > 0;
      rec.add({ case_id: `DEF-NAV-${t.schema_label}`, gate: 'FE-01', title: `${t.title}: reachable from #${route} and titled as in Figma`, steps: `#${route} → Definitions → Definition type "${t.title}"`,
        expected: `select offers "${t.title}"; h2 "${t.title}"`, actual: `${r.nav || 'n/a'}${r.nav_issue ? ' [' + r.nav_issue + ']' : ''}; options=${(r.module_type_options || []).join(' | ')}; h2=${(h.h2s || []).slice(0, 4).join(' | ')}`.slice(0, 1200),
        result: !r.nav_issue && (h.h2s || []).includes(t.title) ? 'PASS' : 'FAIL', input_mode: 'trusted-input', browser: `chromium ${out.browserVersion}`, evidence: r.screenshot });
      rec.add({ case_id: `DEF-CREATE-${t.schema_label}`, gate: 'FE-01', title: `${t.title}: Create local definition with defaults (FND-004 retest)`, steps: 'Click "Create local definition" (trusted); wait ≤6 s for editor or error',
        expected: 'editor opens (definition-* controls rendered), no error notice', actual: `editor fields=${ed.fields.length}; status=${(ed.status || []).join(' / ')}; notices=${(ed.notices || []).join(' / ')}; ${r.error || ''}`.slice(0, 1200),
        result: created && !(ed.notices || []).some(n => /invalid|error|failed|must not|cannot|not allowed/i.test(n)) ? 'PASS' : 'FAIL', input_mode: 'trusted-input', browser: `chromium ${out.browserVersion}`, evidence: r.screenshot });
      const hb = r.header_after && r.header_after.badge ? r.header_after : h;
      const badgeN = hb.badge ? Number(hb.badge.match(/^(\d+)/)[1]) : null;
      const figSec = t.groups.map(g => `${g.group} ${g.fields.length}`);
      const depSec = hb.secNav || [];
      rec.add({ case_id: `DEF-COUNT-${t.schema_label}`, gate: 'FE-01', title: `${t.title}: field count and section groups vs Figma`, steps: 'Read "<n> fields" badge and "Definition sections" nav',
        expected: `${t.field_count} fields; sections ${figSec.join(', ')}`, actual: `badge=${hb.badge}; sections ${depSec.join(', ')}`.slice(0, 1200),
        result: badgeN === t.field_count && JSON.stringify(depSec.map(norm)) === JSON.stringify(figSec.map(norm)) ? 'PASS' : 'FAIL', input_mode: 'observation', browser: `chromium ${out.browserVersion}`, evidence: r.screenshot });
      const diffs = created ? compareFields(t, ed.fields) : null;
      r.diffs = diffs;
      rec.add({ case_id: `DEF-FIELDS-${t.schema_label}`, gate: 'FE-01', title: `${t.title}: field contract (key, label, required, unit, range, options) vs Figma frame ${t.figma_dark}`,
        steps: 'Read every definition-<key> control in the editor; compare with Figma field list', expected: `${t.field_count} Figma fields, all attributes identical, no extra keys`,
        actual: diffs === null ? 'editor not opened — not evaluable' : `${ed.fields.length} deployed controls; ${diffs.length} differences: ${diffs.slice(0, 25).map(d => `${d.key}:${d.issue}${d.figma !== undefined ? ' fig=' + d.figma : ''}${d.deployed !== undefined ? ' dep=' + d.deployed : ''}`).join(' | ')}`.slice(0, 1800),
        result: diffs === null ? 'BLOCKED' : (diffs.filter(d => d.issue !== 'RANGE_NOT_ENFORCED_IN_DOM').length ? 'FAIL' : 'PASS'), input_mode: 'observation', browser: `chromium ${out.browserVersion}`, evidence: r.screenshot,
        ...(diffs === null ? { blocked_reason: 'BLOCKED_BY_FND-004: editor did not open' } : {}) });
    }
    await ctx.close();
  }
  await browser.close();
  rec.add({ case_id: 'DEF-NOWRITE', gate: 'FE-04', title: 'Definitions run issued no non-GET request to the target origin', steps: 'Count non-GET requests', expected: '0', actual: String(out.nonGet.length), result: out.nonGet.length ? 'FAIL' : 'PASS', input_mode: 'observation', browser: `chromium ${out.browserVersion}` });
  writeJSON(rec.evidenceFile('definitions.json', { evidence_type: 'definition-contract', oracle: 'figma unified fields frames (49)', synthetic_data: 'local drafts in ephemeral profile' }), out);
  rec.save();
  const by = id => rec.cases.filter(c => c.case_id.startsWith(id));
  return Object.fromEntries(['DEF-NAV', 'DEF-CREATE', 'DEF-COUNT', 'DEF-FIELDS'].map(k => [k, `${by(k).filter(c => c.result === 'PASS').length}/${by(k).length}`]));
}
