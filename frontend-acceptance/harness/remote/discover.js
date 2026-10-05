// R2-002 discovery: per hash route, compact structural inventory (no screenshots).
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errs = [];
  addEventListener('error', e => errs.push('error:' + (e.message || e.type)));
  addEventListener('unhandledrejection', e => errs.push('rejection:' + String(e.reason).slice(0, 120)));
  const oce = console.error; console.error = (...a) => { errs.push('console.error:' + a.map(String).join(' ').slice(0, 160)); oce.apply(console, a); };
  const nm = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  const routes = [...new Set([...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')))].filter(h => h !== '#main');
  const out = { routes: {}, shell: {}, env: { w: innerWidth, h: innerHeight, vis: document.visibilityState, theme: document.documentElement.dataset.theme || null, lang: document.documentElement.lang, title: document.title } };
  out.shell.landmarks = [...document.querySelectorAll('header,nav,main,aside,footer,[role=banner],[role=navigation],[role=main],[role=complementary],[role=contentinfo],[role=search]')].map(e => e.tagName.toLowerCase() + (e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : '') + (e.getAttribute('aria-label') ? '"' + e.getAttribute('aria-label') + '"' : ''));
  out.shell.navLinks = [...document.querySelectorAll('nav a[href^="#"]')].map(a => a.getAttribute('href') + '=' + nm(a) + (a.getAttribute('aria-current') ? '*' : ''));
  out.shell.skip = [...document.querySelectorAll('a[href="#main"]')].map(nm);
  out.shell.headerButtons = [...document.querySelectorAll('header button, [role=banner] button')].map(nm);
  for (const r of routes) {
    location.hash = r; await sleep(800);
    const main = document.querySelector('main') || document.body;
    out.routes[r] = {
      h: [...main.querySelectorAll('h1,h2,h3')].slice(0, 14).map(x => x.tagName[1] + ':' + nm(x)),
      buttons: [...main.querySelectorAll('button,[role=button]')].slice(0, 40).map(nm),
      inputs: [...main.querySelectorAll('input,select,textarea')].slice(0, 20).map(i => i.tagName.toLowerCase() + ':' + (i.type || '') + ':' + (i.labels?.[0]?.textContent?.trim().slice(0, 30) || i.getAttribute('aria-label') || i.placeholder || i.name || '')),
      tabs: [...main.querySelectorAll('[role=tab]')].map(nm),
      roles: [...new Set([...main.querySelectorAll('[role]')].map(e => e.getAttribute('role')))],
      tables: main.querySelectorAll('table').length, dialogs: document.querySelectorAll('dialog,[role=dialog]').length,
      text: main.innerText.length, sample: main.innerText.replace(/\s+/g, ' ').slice(0, 260),
      current: [...document.querySelectorAll('[aria-current]')].map(nm).slice(0, 3),
      title: document.title,
    };
  }
  out.storage = { ls: Object.keys(localStorage), ss: Object.keys(sessionStorage) };
  try { out.storage.idb = (await indexedDB.databases()).map(d => d.name + '@' + d.version); } catch (e) { out.storage.idb = String(e); }
  out.errs = errs.slice(0, 30);
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  const d = document.createElement('i'); d.id = '__atlas_done'; document.body.appendChild(d);
})();
