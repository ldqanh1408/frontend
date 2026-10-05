// FE02 in-page detector. Returns compact metrics for the current document.
window.__atlasDetect = function (root) {
  root = root || document;
  const win = root.defaultView || window;
  const vw = win.innerWidth, vh = win.innerHeight;
  const de = root.documentElement;
  const isVisible = el => { const cs = win.getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return false; if (el.closest('[hidden],[aria-hidden="true"],[inert]')) return false; return true; };
  const ctrlSel = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[role=option],[role=treeitem],[tabindex]:not([tabindex="-1"])';
  const ctrls = [...root.querySelectorAll(ctrlSel)].filter(isVisible);
  const lbl = el => {
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map(id => root.getElementById(id)?.textContent || '').join(' ').trim(); if (t) return t; }
    if (el.labels && el.labels.length) { const t = [...el.labels].map(l => l.textContent).join(' ').trim(); if (t) return t; }
    if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type) && el.value) return el.value;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (t && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return t;
    const img = el.querySelector && el.querySelector('img[alt],svg[aria-label]'); if (img) return img.getAttribute('alt') || img.getAttribute('aria-label');
    const ti = el.getAttribute('title'); if (ti && ti.trim()) return ti.trim();
    return '';
  };
  const desc = el => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + '"' + lbl(el).slice(0, 24) + '"');
  const scrollableX = el => { for (let p = el.parentElement; p && p !== root.body; p = p.parentElement) { const cs = win.getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  const clippedHidden = el => { for (let p = el.parentElement; p && p !== root.body; p = p.parentElement) { const cs = win.getComputedStyle(p); if (/(hidden|clip)/.test(cs.overflowX)) { const pr = p.getBoundingClientRect(), r = el.getBoundingClientRect(); if (r.right <= pr.left || r.left >= pr.right) return true; } } return false; };
  const res = { vw, vh, vis: root.visibilityState, overflowX: Math.max(0, de.scrollWidth - de.clientWidth), offscreen: [], unnamed: [], small: [], h1: 0, skips: [], contrast: [], contrastUnknown: 0, landmarks: {} };
  for (const el of ctrls) {
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !scrollableX(el) && !clippedHidden(el)) res.offscreen.push(desc(el));
    if (!lbl(el)) res.unnamed.push(desc(el));
  }
  // Target size (WCAG 2.5.8) with spacing exception; inline text links are excluded
  const targets = ctrls.filter(el => !(el.tagName === 'A' && win.getComputedStyle(el).display === 'inline' && el.closest('p,li,dd,td'))).map(el => ({ el, r: el.getBoundingClientRect() }));
  const distRect = (cx, cy, r) => { const dx = Math.max(r.left - cx, 0, cx - r.right), dy = Math.max(r.top - cy, 0, cy - r.bottom); return Math.hypot(dx, dy); };
  for (const t of targets) {
    if (t.r.width >= 24 && t.r.height >= 24) continue;
    const cx = (t.r.left + t.r.right) / 2, cy = (t.r.top + t.r.bottom) / 2;
    const undersized = o => o.r.width < 24 || o.r.height < 24;
    const partner = targets.find(o => o !== t && !o.el.contains(t.el) && !t.el.contains(o.el) && (distRect(cx, cy, o.r) < 12 || (undersized(o) && Math.hypot(cx - (o.r.left + o.r.right) / 2, cy - (o.r.top + o.r.bottom) / 2) < 24)));
    if (partner) res.small.push(desc(t.el) + ' ' + Math.round(t.r.width) + 'x' + Math.round(t.r.height) + ' ~ ' + desc(partner.el).slice(0, 40));
  }
  const main = root.querySelector('main') || root.body;
  res.h1 = main.querySelectorAll('h1').length;
  let prev = 0; for (const h of main.querySelectorAll('h1,h2,h3,h4,h5,h6')) { if (!isVisible(h)) continue; const l = Number(h.tagName[1]); if (prev && l > prev + 1) res.skips.push('h' + prev + '>h' + l + ':' + h.textContent.trim().slice(0, 20)); prev = l; }
  res.landmarks = { main: root.querySelectorAll('main,[role=main]').length, nav: root.querySelectorAll('nav,[role=navigation]').length, banner: root.querySelectorAll('header,[role=banner]').length };
  // Contrast (WCAG 1.4.3) from computed styles; gradients/images => unknown
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = el => { const layers = []; for (let p = el; p; p = p.parentElement) { const cs = win.getComputedStyle(p); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let bg = { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg); return bg; };
  const seen = new Set();
  const walker = root.createTreeWalker(root.body, NodeFilter.SHOW_TEXT);
  let n, checked = 0;
  while ((n = walker.nextNode()) && checked < 2500) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (!isVisible(el) || el.closest('pre#__atlas_out,svg')) continue;
    checked++;
    const cs = win.getComputedStyle(el);
    const fg = parse(cs.color); const bg = bgOf(el);
    if (!fg || !bg) { res.contrastUnknown++; continue; }
    const f = blend(fg, bg); const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const disabled = el.closest('[disabled],[aria-disabled="true"]');
    if (!disabled && ratio < (large ? 3 : 4.5)) res.contrast.push(desc(el).slice(0, 50) + ' ' + ratio.toFixed(2));
  }
  res.textChecked = checked;
  return res;
};
