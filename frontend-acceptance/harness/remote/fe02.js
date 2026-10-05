// FE02-AUTO-216 batch for one viewport: probe validation, then 18 routes x {dark, light}.
// Requires detector.js to be injected first (window.__atlasDetect).
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const EXP = {home:'Build with a clear trail.',specifications:'Specifications',code:'Code intelligence',agents:'Agents',resources:'Resources',memory:'Memory',workflow:'Workflow',execution:'Execution',governance:'Delivery & acceptance',gateway:'AI gateway',collaboration:'Collaboration',configuration:'Configuration',identity:'Identity & access',tenancy:'Organization & projects',saas:'Usage & billing',desktop:'Desktop companion',observer:'Observer',connection:'Connection & operations'};
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.style.display = 'none'; document.body.appendChild(pre);
  const out = { env: { w: innerWidth, h: innerHeight, vis: document.visibilityState, dpr: devicePixelRatio, coarse: matchMedia('(pointer:coarse)').matches }, probe: null, rows: {}, samples: { offscreen: [], unnamed: [], small: [], skips: [], contrast: [] }, errs: [] };
  const flush = () => { pre.textContent = JSON.stringify(out); };
  addEventListener('error', e => out.errs.push(location.hash + ' ' + e.message));
  addEventListener('unhandledrejection', e => out.errs.push(location.hash + ' rej ' + String(e.reason).slice(0, 100)));
  // 1) probe validation in a same-origin srcdoc iframe sized to the viewport
  const pf = document.createElement('iframe'); pf.style.cssText = 'position:absolute;left:0;top:0;border:0;width:' + innerWidth + 'px;height:' + innerHeight + 'px;visibility:visible';
  pf.srcdoc = '<!doctype html><html><body style="background:#fff;color:#000;margin:0"><header>h</header><nav>n</nav><main><h1>Probe</h1><h3>skip</h3><div style="width:' + (innerWidth + 300) + 'px;background:#eee">wide</div><button aria-label=""></button><button style="width:10px;height:10px;padding:0">a</button><button style="width:10px;height:10px;padding:0">b</button><p style="color:#777;background:#888">low contrast</p><button style="position:relative;left:' + (innerWidth + 200) + 'px">off</button></main></body></html>';
  await new Promise(r => { pf.onload = r; document.body.appendChild(pf); });
  const pr = window.__atlasDetect(pf.contentDocument);
  out.probe = { overflowX: pr.overflowX > 0, offscreen: pr.offscreen.length >= 1, unnamed: pr.unnamed.length >= 1, small: pr.small.length >= 2, skips: pr.skips.length >= 1, contrast: pr.contrast.length >= 1, vw: pr.vw };
  out.probe.valid = Object.values(out.probe).filter(v => v === true).length === 6;
  pf.remove(); flush();
  const add = (k, arr) => { for (const s of arr) if (!out.samples[k].includes(s) && out.samples[k].length < 14) out.samples[k].push(s); };
  const themeBtn = () => [...document.querySelectorAll('button')].find(b => /switch display theme/i.test(b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || ''));
  for (const theme of ['dark', 'light']) {
    if (document.documentElement.dataset.theme !== theme) { const b = themeBtn(); if (b) b.click(); await sleep(400); }
    out['theme_' + theme] = document.documentElement.dataset.theme;
    for (const [r, want] of Object.entries(EXP)) {
      location.hash = r;
      const t = Date.now(); while (Date.now() - t < 3000) { const h = document.querySelector('main h1'); if (h && h.textContent.trim() === want) break; await sleep(40); }
      let last = -1, stable = 0; const t2 = Date.now();
      while (Date.now() - t2 < 2500 && stable < 2) { await sleep(120); const L = (document.querySelector('main') || document.body).innerText.length; stable = L === last ? stable + 1 : 0; last = L; }
      const d = window.__atlasDetect(document);
      out.rows[theme + ':' + r] = [d.overflowX, d.offscreen.length, d.unnamed.length, d.small.length, d.h1, d.skips.length, d.contrast.length, d.contrastUnknown, d.textChecked];
      add('offscreen', d.offscreen.map(s => r + ':' + s)); add('unnamed', d.unnamed.map(s => r + ':' + s)); add('small', d.small.map(s => r + ':' + s)); add('skips', d.skips.map(s => r + ':' + s)); add('contrast', d.contrast.map(s => theme + ':' + r + ':' + s));
      flush();
    }
  }
  out.cols = ['overflowX', 'offscreen', 'unnamed', 'small', 'h1', 'skips', 'contrast', 'contrastUnknown', 'textChecked'];
  out.complete = 1; flush();
  const dn = document.createElement('i'); dn.id = '__atlas_done'; document.body.appendChild(dn);
})();
