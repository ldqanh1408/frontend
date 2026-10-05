// CF-PRE-008 / FE01-ROUTE-001..003: direct load, reload, Back/Forward, query, unknown hash — via same-origin iframes.
// A FRESH iframe is created per load (hash-only src changes do not fire 'load'; that bug made the first version hang).
// This is the exact logic executed in Cloudflare Browser Rendering on 2026-10-05 (two batches of 9 routes).
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const EXP = {home:'Build with a clear trail.',specifications:'Specifications',code:'Code intelligence',agents:'Agents',resources:'Resources',memory:'Memory',workflow:'Workflow',execution:'Execution',governance:'Delivery & acceptance',gateway:'AI gateway',collaboration:'Collaboration',configuration:'Configuration',identity:'Identity & access',tenancy:'Organization & projects',saas:'Usage & billing',desktop:'Desktop companion',observer:'Observer',connection:'Connection & operations'};
  const ROUTES = window.__ROUTES || Object.keys(EXP);
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.style.display = 'none'; document.body.appendChild(pre);
  const out = { direct: {}, reload: {}, t: [], errs: [] };
  const flush = () => { pre.textContent = JSON.stringify(out); };
  let fr;
  const doc = () => fr.contentDocument;
  const h1 = () => { try { const e = doc().querySelector('main h1'); return e ? e.textContent.trim() : null; } catch (e) { return 'ERR'; } };
  const waitH1 = async (want, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = h1(); if (v && (!want || v === want)) return v; await sleep(50); } return h1(); };
  const hook = () => { const w = fr.contentWindow; w.addEventListener('error', e => out.errs.push(w.location.hash + ' ' + e.message)); w.addEventListener('unhandledrejection', e => out.errs.push(w.location.hash + ' rej ' + String(e.reason).slice(0, 100))); };
  const fresh = src => new Promise(res => { if (fr) fr.remove(); fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:800px;border:0;z-index:99999'; fr.onload = () => { hook(); res(); }; fr.src = src; document.body.appendChild(fr); });
  const reload = () => new Promise(res => { fr.onload = () => { hook(); res(); }; fr.contentWindow.location.reload(); });
  const t0 = performance.now();
  for (const r of ROUTES) {
    const want = EXP[r];
    await fresh('/#' + r);
    const a = await waitH1(want);
    const cur = [...doc().querySelectorAll('nav a[aria-current]')].map(x => x.getAttribute('href'));
    out.direct[r] = [a === want ? 1 : 0, a, cur.join(',')];
    await reload();
    const b = await waitH1(want);
    out.reload[r] = [b === want && fr.contentWindow.location.hash === '#' + r ? 1 : 0, b, fr.contentWindow.location.hash];
    out.t.push(Math.round(performance.now() - t0)); flush();
  }
  await fresh('/#home'); await waitH1(EXP.home);
  const w = fr.contentWindow;
  w.location.hash = '#specifications'; await waitH1(EXP.specifications);
  w.location.hash = '#code'; await waitH1(EXP.code);
  const hist = [];
  w.history.back(); await sleep(300); hist.push(['back1', w.location.hash, await waitH1(EXP.specifications)]);
  w.history.back(); await sleep(300); hist.push(['back2', w.location.hash, await waitH1(EXP.home)]);
  w.history.forward(); await sleep(300); hist.push(['fwd1', w.location.hash, await waitH1(EXP.specifications)]);
  out.history = hist;
  out.history_pass = hist[0][1] === '#specifications' && hist[0][2] === EXP.specifications && hist[1][1] === '#home' && hist[1][2] === EXP.home && hist[2][1] === '#specifications' && hist[2][2] === EXP.specifications ? 1 : 0;
  flush();
  await fresh('/#agents?authority=definitions&atlasProbe=1');
  const q1 = await waitH1(EXP.agents);
  const tabs1 = [...doc().querySelectorAll('[role=tab][aria-selected=true]')].map(t => t.textContent.trim());
  await reload();
  const q2 = await waitH1(EXP.agents);
  out.query = { before: q1, after: q2, hash: fr.contentWindow.location.hash, tabsBefore: tabs1, tabsAfter: [...doc().querySelectorAll('[role=tab][aria-selected=true]')].map(t => t.textContent.trim()) };
  await fresh('/#agents?authority=service');
  await waitH1(EXP.agents); await sleep(300);
  out.query.serviceTab = [...doc().querySelectorAll('[role=tab][aria-selected=true]')].map(t => t.textContent.trim());
  flush();
  await fresh('/#atlas-unknown-route'); await sleep(1500);
  const d = doc(); const mh = d.querySelector('main h1');
  out.unknown = { hash: fr.contentWindow.location.hash, h1: mh ? mh.textContent.trim() : null, text: ((d.querySelector('main') || d.body).innerText).replace(/\s+/g, ' ').slice(0, 220), hasHomeLink: !!d.querySelector('a[href="#home"]') };
  out.complete = 1; flush();
  const dn = document.createElement('i'); dn.id = '__atlas_done'; document.body.appendChild(dn);
})();
