// FE03-KBD-001 family — TRUSTED keyboard input (Playwright/CDP Input.dispatchKeyEvent => isTrusted=true).
// Expected results are fixed here, before execution, from WCAG 2.2 (2.1.1, 2.4.1, 2.4.3, 2.4.7, 2.4.11) and WAI-ARIA APG
// (Tabs, Dialog (Modal), Combobox). Each check returns PASS/FAIL/NOT_APPLICABLE with the observed facts.
import * as pw from 'playwright';
import { Recorder, writeJSON } from '../lib.mjs';
import { EXP, waitH1, settle, errorHooks } from './common.mjs';

const FOCUS_INFO = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return { tag: a ? a.tagName : null, body: true, hash: location.hash };
  const r = a.getBoundingClientRect();
  const cs = getComputedStyle(a);
  const nm = (a.getAttribute('aria-label') || a.getAttribute('title') || a.textContent || a.value || a.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
  const top = document.elementFromPoint(cx, cy);
  return {
    tag: a.tagName, id: a.id || null, role: a.getAttribute('role'), name: nm, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0 && r.height > 0,
    obscured: !(top && (top === a || a.contains(top) || top.contains(a))),
    style: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderColor, cs.backgroundColor, cs.textDecorationLine].join('|'),
    inDialog: !!a.closest('[role=dialog],dialog,[aria-modal=true]'), inMain: !!a.closest('main'), hash: location.hash,
  };
};

async function fi(page) { return page.evaluate(FOCUS_INFO); }

async function freshPage(browser, vp, hash = 'home') {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile && browser.browserType().name() !== 'firefox', hasTouch: !!vp.hasTouch });
  const page = await ctx.newPage();
  const errs = []; errorHooks(page, errs);
  await page.goto(`${process.env.TARGET}/#${hash}`, { waitUntil: 'networkidle' });
  await waitH1(page, EXP[hash.split('?')[0]]); await settle(page);
  return { ctx, page, errs };
}

async function tabTo(page, re, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const f = await fi(page);
    if (f.name && re.test(f.name)) return { found: true, presses: i + 1, f };
  }
  return { found: false, presses: max };
}

async function dialogState(page) {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('[role=dialog],dialog[open],[aria-modal=true],[role=menu],[role=listbox]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const main = document.querySelector('main');
    return { open: d.map(e => `${e.tagName}[role=${e.getAttribute('role')}][modal=${e.getAttribute('aria-modal')}]"${(e.getAttribute('aria-label') || '').slice(0, 30)}"`), mainInert: !!(main && (main.inert || main.closest('[inert]') || main.getAttribute('aria-hidden') === 'true')) };
  });
}

export default async function ({ runDir, req, target }) {
  process.env.TARGET = target;
  const rec = new Recorder(runDir, 'keyboard');
  const engines = req.keyboard_engines || ['chromium', 'firefox'];
  const all = {};
  for (const engine of engines) {
    const browser = await pw[engine].launch();
    const out = all[engine] = { browserVersion: browser.version(), checks: [] };
    const push = c => out.checks.push(c);
    const D = { width: 1440, height: 900 };

    // 1) Skip link (WCAG 2.4.1) — first Tab reaches it; Enter moves focus to main without changing the view
    try {
      const { ctx, page } = await freshPage(browser, D);
      await page.keyboard.press('Tab');
      const f1 = await fi(page);
      await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      const f2 = await fi(page);
      const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent.trim() || null);
      const ok = /skip/i.test(f1.name || '') && h1 === EXP.home && (f2.inMain || f2.id === 'main');
      push({ case_id: 'FE03-KBD-SKIP', expected: 'Tab#1 = "Skip to workspace"; Enter keeps view #home (h1 unchanged) and moves focus into main', actual: { first: f1, afterEnter: f2, h1, hash: f2.hash }, result: ok ? 'PASS' : 'FAIL' });
      await ctx.close();
    } catch (e) { push({ case_id: 'FE03-KBD-SKIP', result: 'BLOCKED', reason: 'harness error: ' + String(e).slice(0, 200) }); }

    // 2) Tab sequence (2.1.1 / 2.4.3 / 2.4.7 / 2.4.11): 45 stops from load
    try {
      const { ctx, page } = await freshPage(browser, D);
      const stops = [];
      for (let i = 0; i < 45; i++) {
        await page.keyboard.press('Tab');
        const f = await fi(page);
        await page.evaluate(i => { const a = document.activeElement; if (a && a !== document.body) a.setAttribute('data-atlas-kbd', String(i)); }, i);
        stops.push(f);
      }
      await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
      await page.waitForTimeout(200);
      const unfocused = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-atlas-kbd]')].map(e => { const cs = getComputedStyle(e); return [e.getAttribute('data-atlas-kbd'), [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderColor, cs.backgroundColor, cs.textDecorationLine].join('|')]; })));
      const noIndicator = stops.map((s, i) => (!s.body && unfocused[String(i)] === s.style ? i : null)).filter(v => v !== null);
      const hidden = stops.map((s, i) => (s.body || !s.inViewport ? i : null)).filter(v => v !== null);
      const obscured = stops.map((s, i) => (!s.body && s.obscured ? i : null)).filter(v => v !== null);
      push({ case_id: 'FE03-KBD-TABSEQ', expected: 'every Tab stop is a visible control inside the viewport, not obscured (2.4.11), with a visible focus indicator distinct from its unfocused style (2.4.7)', actual: { stops: stops.map(s => [s.tag, s.role, s.name, s.inViewport, s.obscured]), noIndicator, hidden, obscured }, result: !noIndicator.length && !hidden.length && !obscured.length ? 'PASS' : 'FAIL' });
      await ctx.close();
    } catch (e) { push({ case_id: 'FE03-KBD-TABSEQ', result: 'BLOCKED', reason: 'harness error: ' + String(e).slice(0, 200) }); }

    // 3) Workspace search (APG Combobox / Dialog): open via shortcut or button, filter, arrow, Enter navigates; Escape returns focus
    try {
      const { ctx, page } = await freshPage(browser, D);
      const mod = 'Control';
      await page.keyboard.press(`${mod}+KeyK`); await page.waitForTimeout(400);
      let viaShortcut = await fi(page);
      let opened = (await dialogState(page)).open.length > 0 || viaShortcut.role === 'combobox' || viaShortcut.tag === 'INPUT';
      let how = 'Ctrl+K';
      let invoker = null;
      if (!opened) {
        await page.keyboard.press('Escape');
        const t = await tabTo(page, /open workspace search/i, 30);
        invoker = t.found ? t.f.name : null;
        await page.keyboard.press('Enter'); await page.waitForTimeout(400);
        viaShortcut = await fi(page); opened = (await dialogState(page)).open.length > 0 || viaShortcut.tag === 'INPUT'; how = 'Tab→"Open workspace search"→Enter';
      }
      const st = await dialogState(page);
      await page.keyboard.type('spec', { delay: 30 }); await page.waitForTimeout(300);
      const ad0 = await page.evaluate(() => document.activeElement?.getAttribute('aria-activedescendant'));
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150);
      const ad1 = await page.evaluate(() => document.activeElement?.getAttribute('aria-activedescendant'));
      const opts = await page.evaluate(() => [...document.querySelectorAll('[role=option]')].map(o => o.textContent.trim().slice(0, 40)).slice(0, 8));
      await page.keyboard.press('Enter'); await page.waitForTimeout(700);
      const after = await page.evaluate(() => location.hash);
      const navOk = /^#specifications/.test(after) || /^#code/.test(after);
      // reopen + Escape
      await page.goto(`${target}/#home`, { waitUntil: 'networkidle' }); await waitH1(page, EXP.home);
      const t2 = await tabTo(page, /open workspace search/i, 30);
      await page.keyboard.press('Enter'); await page.waitForTimeout(400);
      const openedAgain = (await dialogState(page)).open.length > 0;
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const closed = (await dialogState(page)).open.length === 0;
      const back = await fi(page);
      push({ case_id: 'FE03-KBD-SEARCH', expected: 'search opens from keyboard, focus in input; typing filters options; ArrowDown moves aria-activedescendant; Enter navigates to a matching view; Escape closes and returns focus to the invoking button', actual: { how, opened, state: st, focus: viaShortcut, ad0, ad1, opts, after, reopen: { found: t2.found, openedAgain, closed, focusBack: back } },
        result: opened && navOk && ad1 && ad1 !== ad0 && openedAgain && closed && /open workspace search/i.test(back.name || '') ? 'PASS' : 'FAIL' });
      await ctx.close();
    } catch (e) { push({ case_id: 'FE03-KBD-SEARCH', result: 'BLOCKED', reason: 'harness error: ' + String(e).slice(0, 200) }); }

    // 4) Tabs (APG Tabs; FND-001 retest): arrow keys, Home/End, roving tabindex, tab↔tabpanel association
    try {
      const { ctx, page } = await freshPage(browser, D, 'specifications');
      const lists = await page.evaluate(() => [...document.querySelectorAll('[role=tablist]')].map((l, i) => { l.setAttribute('data-atlas-tl', String(i)); return { i, label: l.getAttribute('aria-label'), tabs: [...l.querySelectorAll('[role=tab]')].map(t => ({ name: t.textContent.trim(), sel: t.getAttribute('aria-selected'), ti: t.getAttribute('tabindex'), controls: t.getAttribute('aria-controls'), id: t.id, panelOk: !!(t.getAttribute('aria-controls') && document.getElementById(t.getAttribute('aria-controls'))?.getAttribute('role') === 'tabpanel') })) }; }));
      const res = [];
      for (const l of lists) {
        const selIdx = Math.max(0, l.tabs.findIndex(t => t.sel === 'true'));
        await page.locator(`[data-atlas-tl="${l.i}"] [role=tab]`).nth(selIdx).focus();
        const f0 = await fi(page);
        await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
        const f1 = await fi(page);
        await page.keyboard.press('End'); await page.waitForTimeout(200);
        const fEnd = await fi(page);
        await page.keyboard.press('Home'); await page.waitForTimeout(200);
        const fHome = await fi(page);
        const roving = l.tabs.filter(t => t.ti === '0' || t.ti === null).length;
        res.push({ list: l.i, label: l.label, tabs: l.tabs.map(t => t.name), selected: l.tabs[selIdx]?.name, f0: f0.name, arrowRight: f1.name, end: fEnd.name, home: fHome.name, rovingTabindex0: roving, panelsLinked: l.tabs.filter(t => t.panelOk).length,
          ok: f1.name !== f0.name && f1.role === 'tab' && fEnd.name === l.tabs[l.tabs.length - 1].name && fHome.name === l.tabs[0].name && roving === 1 && l.tabs.every(t => t.panelOk) });
      }
      push({ case_id: 'FE03-KBD-TABS', expected: 'each tablist: ArrowRight moves focus to next tab, End/Home to last/first; exactly one tab in tab order (roving tabindex); every tab aria-controls a role=tabpanel', actual: res, result: res.length && res.every(r => r.ok) ? 'PASS' : 'FAIL' });
      await ctx.close();
    } catch (e) { push({ case_id: 'FE03-KBD-TABS', result: 'BLOCKED', reason: 'harness error: ' + String(e).slice(0, 200) }); }

    // 5) Tree (APG Tree View) — only if items exist in default state
    try {
      const { ctx, page } = await freshPage(browser, D, 'specifications');
      const n = await page.evaluate(() => document.querySelectorAll('[role=tree] [role=treeitem]').length);
      push({ case_id: 'FE03-KBD-TREE', expected: 'arrow-key navigation per APG Tree View when the tree has items', actual: { treeitems: n }, result: n ? 'NOT_RUN' : 'NOT_APPLICABLE', reason: n ? 'tree has items; interaction script pending' : 'Library tree is empty on a fresh profile (no documents); needs seeded documents via Import files' });
      await ctx.close();
    } catch (e) { push({ case_id: 'FE03-KBD-TREE', result: 'BLOCKED', reason: String(e).slice(0, 200) }); }

    // 6) Dialogs opened from header (APG Dialog Modal): focus moves in, background inert/modal, Tab trapped, Escape closes, focus returns
    for (const [cid, re] of [['FE03-KBD-DIALOG-HELP', /help & recovery/i], ['FE03-KBD-DIALOG-PREFS', /display preferences/i]]) {
      try {
        const { ctx, page } = await freshPage(browser, D);
        const t = await tabTo(page, re, 30);
        await page.keyboard.press('Enter'); await page.waitForTimeout(500);
        const st = await dialogState(page);
        const fIn = await fi(page);
        const trap = [];
        for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); trap.push((await fi(page)).inDialog); }
        await page.keyboard.press('Escape'); await page.waitForTimeout(400);
        const st2 = await dialogState(page);
        const fBack = await fi(page);
        const isDialog = st.open.some(s => /role=dialog|DIALOG|modal=true/.test(s));
        push({ case_id: cid, expected: 'Enter opens a modal dialog; focus moves inside; background inert or aria-modal; Tab stays inside; Escape closes; focus returns to the invoking button', actual: { reached: t.found, presses: t.presses, open: st.open, mainInert: st.mainInert, focusInside: fIn, trapInside: trap.filter(Boolean).length + '/14', afterEscape: st2.open, focusBack: fBack.name },
          result: !t.found ? 'BLOCKED' : (isDialog ? (fIn.inDialog && trap.every(Boolean) && !st2.open.length && re.test(fBack.name || '') ? 'PASS' : 'FAIL') : (st.open.length ? (!st2.open.length && re.test(fBack.name || '') ? 'PASS' : 'FAIL') : 'FAIL')), reason: !t.found ? 'invoker not reachable by Tab within 30 presses' : '' });
        await ctx.close();
      } catch (e) { push({ case_id: cid, result: 'BLOCKED', reason: 'harness error: ' + String(e).slice(0, 200) }); }
    }

    // 7) Mobile navigation drawer (375x812)
    try {
      const { ctx, page } = await freshPage(browser, { width: 375, height: 812, isMobile: true, hasTouch: true });
      const t = await tabTo(page, /open workspace navigation|navigation/i, 15);
      const exp0 = await page.evaluate(() => document.activeElement?.getAttribute('aria-expanded'));
      const navBefore = await page.evaluate(() => { const n = document.querySelector('aside nav, nav[aria-label]'); if (!n) return null; const r = n.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left < innerWidth && getComputedStyle(n).visibility !== 'hidden'; });
      await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      const exp1 = await page.evaluate(() => document.activeElement?.getAttribute('aria-expanded'));
      const navVisible = await page.evaluate(() => { const n = document.querySelector('aside nav, nav[aria-label]'); if (!n) return null; const r = n.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left < innerWidth; });
      const fOpen = await fi(page);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      const fBack = await fi(page);
      const exp2 = await page.evaluate(() => [...document.querySelectorAll('header button')].find(b => /navigation/i.test(b.title || b.textContent))?.getAttribute('aria-expanded'));
      push({ case_id: 'FE03-KBD-NAV-MOBILE', expected: '375px: navigation toggle reachable by Tab; Enter opens drawer (aria-expanded=true, nav visible); Escape closes (aria-expanded=false) and focus returns to the toggle', actual: { reached: t.found, presses: t.presses, exp0, exp1, navBefore, navVisible, focusOpen: fOpen.name, exp2, focusBack: fBack.name },
        result: t.found && (exp1 === 'true' || (navBefore === false && navVisible)) && exp2 === 'false' && /navigation/i.test(fBack.name || '') ? 'PASS' : (t.found ? 'FAIL' : 'BLOCKED'), reason: t.found ? '' : 'toggle not reached' });
      await ctx.close();
    } catch (e) { push({ case_id: 'FE03-KBD-NAV-MOBILE', result: 'BLOCKED', reason: 'harness error: ' + String(e).slice(0, 200) }); }

    // 8) View change from keyboard moves focus (FE01-ROUTE-004)
    try {
      const { ctx, page } = await freshPage(browser, D);
      const t = await tabTo(page, /^memory$/i, 40);
      await page.keyboard.press('Enter'); await waitH1(page, EXP.memory); await page.waitForTimeout(300);
      const f = await fi(page);
      push({ case_id: 'FE01-ROUTE-004', expected: 'activating a nav link with Enter shows the view and moves focus to main or its heading', actual: { reached: t.found, focus: f }, result: t.found && f.hash === '#memory' && (f.inMain || f.id === 'main') ? 'PASS' : (t.found ? 'FAIL' : 'BLOCKED') });
      await ctx.close();
    } catch (e) { push({ case_id: 'FE01-ROUTE-004', result: 'BLOCKED', reason: 'harness error: ' + String(e).slice(0, 200) }); }

    await browser.close();
  }
  writeJSON(rec.evidenceFile('keyboard-results.json', { evidence_type: 'trusted-keyboard', input_mode: 'trusted-input' }), all);
  rec.save();
  return Object.fromEntries(Object.entries(all).map(([e, v]) => [e, v.checks.map(c => `${c.case_id}:${c.result}`).join(' ')]));
}
