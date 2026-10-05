// CF-PRE-008 / FE01-ROUTE-001..003: direct load, reload, Back/Forward, query, unknown hash — via same-origin iframes.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const EXP = {home:'Build with a clear trail.',specifications:'Specifications',code:'Code intelligence',agents:'Agents',resources:'Resources',memory:'Memory',workflow:'Workflow',execution:'Execution',governance:'Delivery & acceptance',gateway:'AI gateway',collaboration:'Collaboration',configuration:'Configuration',identity:'Identity & access',tenancy:'Organization & projects',saas:'Usage & billing',desktop:'Desktop companion',observer:'Observer',connection:'Connection & operations'};
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:800px;border:0;z-index:99999'; document.body.appendChild(fr);
  const doc = () => fr.contentDocument;
  const h1 = () => { try { return doc().querySelector('main h1')?.textContent.trim() || null; } catch (e) { return 'ERR'; } };
  const waitH1 = async (want, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = h1(); if (v && (!want || v === want)) return v; await sleep(60); } return h1(); };
  const load = src => new Promise(res => { fr.onload = () => res(); fr.src = src; });
  const errs = [];
  const hook = () => { const w = fr.contentWindow; w.addEventListener('error', e => errs.push(w.location.hash + ' ' + e.message)); w.addEventListener('unhandledrejection', e => errs.push(w.location.hash + ' rej ' + String(e.reason).slice(0, 100))); };
  const out = { direct: {}, reload: {}, errs };
  for (const [r, want] of Object.entries(EXP)) {
    await load('/#' + r); hook();
    const a = await waitH1(want);
    const cur = [...doc().querySelectorAll('nav a[aria-current]')].map(x => x.getAttribute('href'));
    out.direct[r] = [a === want ? 1 : 0, a, cur.join(',')];
    const p = new Promise(res => { fr.onload = () => res(); }); fr.contentWindow.location.reload(); await p; hook();
    const b = await waitH1(want);
    out.reload[r] = [b === want && fr.contentWindow.location.hash === '#' + r ? 1 : 0, b, fr.contentWindow.location.hash];
  }
  // Back / Forward within one document history
  await load('/#home'); hook(); await waitH1(EXP.home);
  const w = fr.contentWindow;
  const go = async h => { w.location.hash = h; await sleep(400); };
  await go('#specifications'); await waitH1(EXP.specifications);
  await go('#code'); await waitH1(EXP.code);
  const hist = [];
  w.history.back(); await sleep(500); hist.push(['back1', w.location.hash, await waitH1(EXP.specifications)]);
  w.history.back(); await sleep(500); hist.push(['back2', w.location.hash, await waitH1(EXP.home)]);
  w.history.forward(); await sleep(500); hist.push(['fwd1', w.location.hash, await waitH1(EXP.specifications)]);
  out.history = hist;
  out.history_pass = hist[0][1] === '#specifications' && hist[0][2] === EXP.specifications && hist[1][1] === '#home' && hist[1][2] === EXP.home && hist[2][1] === '#specifications' && hist[2][2] === EXP.specifications ? 1 : 0;
  // Query string inside hash survives reload and selects the route
  await load('/#agents?authority=definitions&atlasProbe=1'); hook();
  const q1 = await waitH1(EXP.agents);
  const p2 = new Promise(res => { fr.onload = () => res(); }); fr.contentWindow.location.reload(); await p2; hook();
  const q2 = await waitH1(EXP.agents);
  out.query = { before: q1, after: q2, hash: fr.contentWindow.location.hash, activeTab: [...doc().querySelectorAll('[role=tab][aria-selected=true]')].map(t => t.textContent.trim()) };
  // Unknown hash
  await load('/#atlas-unknown-route'); hook(); await sleep(1200);
  const d = doc();
  out.unknown = { hash: fr.contentWindow.location.hash, h1: d.querySelector('main h1')?.textContent.trim() || null, text: (d.querySelector('main')?.innerText || d.body.innerText).replace(/\s+/g, ' ').slice(0, 200), hasHomeLink: !!d.querySelector('a[href="#home"]') };
  // Focus after in-app route change (informational)
  await load('/#home'); hook(); await waitH1(EXP.home);
  fr.contentWindow.location.hash = '#memory'; await waitH1(EXP.memory); await sleep(300);
  const ae = doc().activeElement; out.focusAfterRoute = ae ? (ae.tagName + '#' + (ae.id || '') + ' ' + (ae.textContent || '').trim().slice(0, 30)) : null;
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  const dn = document.createElement('i'); dn.id = '__atlas_done'; document.body.appendChild(dn);
})();
