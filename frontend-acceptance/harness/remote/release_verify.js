// Injected into the deployment page by Cloudflare Browser Rendering (/content addScriptTag).
// CF-PRE-001..006: recompute SHA-256 in the browser for every payload listed in /release-manifest.json.
(async () => {
  const out = { started: new Date().toISOString(), errors: [] };
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const normHash = h => {
    if (typeof h !== 'string') return null;
    let s = h.replace(/^sha-?256[-:]/i, '');
    if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
    try { const bin = atob(s); if (bin.length === 32) return [...bin].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''); } catch (e) {}
    return null;
  };
  const findEntries = (node, acc = []) => {
    if (Array.isArray(node)) node.forEach(n => findEntries(n, acc));
    else if (node && typeof node === 'object') {
      const ks = Object.keys(node);
      const pk = ks.find(k => /^(path|file|name|url|key|src)$/i.test(k) && typeof node[k] === 'string');
      const hk = ks.find(k => /(sha-?256|hash|digest|integrity)/i.test(k) && typeof node[k] === 'string');
      if (pk && hk) acc.push({ path: node[pk], hash: node[hk], size: node.size ?? node.bytes ?? null });
      else ks.forEach(k => findEntries(node[k], acc));
    }
    return acc;
  };
  try {
    const mr = await fetch('/release-manifest.json', { cache: 'no-store' });
    const mtext = await mr.text();
    out.manifest_http = { status: mr.status, ct: mr.headers.get('content-type'), cc: mr.headers.get('cache-control'), bytes: mtext.length };
    const man = JSON.parse(mtext);
    out.manifest_sha256 = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mtext)));
    out.manifest_top = Object.fromEntries(Object.entries(man).map(([k, v]) => [k, typeof v === 'object' ? (Array.isArray(v) ? `array(${v.length})` : `object(${Object.keys(v).length})`) : v]));
    let entries = findEntries(man);
    if (!entries.length) {
      const walk = (o) => { for (const [k, v] of Object.entries(o || {})) { if (typeof v === 'string' && normHash(v) && /\.[a-z0-9]+$/i.test(k)) entries.push({ path: k, hash: v }); else if (v && typeof v === 'object') walk(v); } };
      walk(man);
    }
    out.entry_sample = entries.slice(0, 2);
    const rows = [];
    let total = 0;
    for (const e of entries) {
      let p = e.path.replace(/^https?:\/\/[^/]+/, ''); if (!p.startsWith('/')) p = '/' + p;
      try {
        const r = await fetch(p, { cache: 'no-store' });
        const buf = await r.arrayBuffer();
        total += buf.byteLength;
        const got = hex(await crypto.subtle.digest('SHA-256', buf));
        rows.push([p, r.status, got === normHash(e.hash) ? 1 : 0, buf.byteLength, e.size, r.headers.get('content-type'), r.headers.get('cache-control'), r.headers.get('etag') ? 1 : 0, got.slice(0, 12)]);
      } catch (err) { rows.push([p, 'ERR', 0, 0, e.size, String(err).slice(0, 80), null, 0, null]); }
    }
    out.rows_cols = ['path', 'status', 'hash_match', 'bytes', 'size_claim', 'content_type', 'cache_control', 'has_etag', 'sha256_12'];
    out.rows = rows;
    out.total_bytes = total;
  } catch (err) { out.errors.push('manifest: ' + String(err)); }
  // document headers + probes
  const probe = async (p, method = 'GET') => {
    try { const r = await fetch(p, { cache: 'no-store', method }); const t = method === 'GET' ? await r.text() : ''; const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return { status: r.status, headers: h, bytes: t.length, shell: /id="root"/.test(t) }; }
    catch (err) { return { error: String(err) }; }
  };
  out.doc = await probe('/');
  out.probes = {};
  for (const p of ['/assets/__atlas_probe_missing__.js', '/assets/__atlas_probe_missing__.css', '/__atlas_probe_missing__', '/home', '/connection', '/index.html', '/harness-blank']) {
    const r = await probe(p); out.probes[p] = { status: r.status, ct: r.headers?.['content-type'], cc: r.headers?.['cache-control'], bytes: r.bytes, shell: r.shell, location: r.headers?.location };
  }
  try { out.uaData = navigator.userAgentData ? await navigator.userAgentData.getHighEntropyValues(['fullVersionList', 'platform', 'platformVersion']) : null; } catch (e) { out.uaData = String(e); }
  out.finished = new Date().toISOString();
  const pre = document.createElement('pre'); pre.id = '__atlas_out'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  const d = document.createElement('i'); d.id = '__atlas_done'; document.body.appendChild(d);
})();
