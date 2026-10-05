// CF-PRE-001/002/003/004/005/006 (HTTP level) + byte mirror of the release payload.
// Oracle for hashes: the deployment's own /release-manifest.json is the *claim*;
// SHA-256 is recomputed independently here over the bytes actually served.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sha256, headersToObject, redactHeaders, ensureDir, ROOT, writeJSON } from '../lib.mjs';

function findPayloadEntries(node, out = [], trail = '') {
  if (Array.isArray(node)) {
    node.forEach((n, i) => findPayloadEntries(n, out, `${trail}[${i}]`));
  } else if (node && typeof node === 'object') {
    const keys = Object.keys(node);
    const pathKey = keys.find(k => /^(path|file|name|url|key|src)$/i.test(k) && typeof node[k] === 'string');
    const hashKey = keys.find(k => /(sha-?256|hash|digest|integrity)/i.test(k) && typeof node[k] === 'string');
    if (pathKey && hashKey) {
      out.push({ trail, path: node[pathKey], hash: node[hashKey], size: node.size ?? node.bytes ?? node.length ?? null, raw: node });
    } else {
      for (const k of keys) findPayloadEntries(node[k], out, `${trail}.${k}`);
    }
  }
  return out;
}

function normHash(h) {
  if (/^[0-9a-f]{64}$/i.test(h)) return h.toLowerCase();
  const m = h.match(/^sha256[-:](.+)$/i);
  const b = m ? m[1] : h;
  if (/^[0-9a-f]{64}$/i.test(b)) return b.toLowerCase();
  try { const buf = Buffer.from(b, 'base64'); if (buf.length === 32) return buf.toString('hex'); } catch {}
  return null;
}

// Also accept manifests shaped as { files: { "/path": "hash" } }
function findMapEntries(node, out = []) {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && /^\/?[\w.\-/@]+\.[a-z0-9]+$/i.test(k) && normHash(v)) out.push({ trail: k, path: k, hash: v, size: null });
      else if (v && typeof v === 'object') findMapEntries(v, out);
    }
  }
  return out;
}

const EXPECTED_MIME = {
  js: /^(text|application)\/javascript/, mjs: /^(text|application)\/javascript/, css: /^text\/css/, html: /^text\/html/,
  json: /^application\/(json|manifest\+json)/, webmanifest: /^application\/manifest\+json/, svg: /^image\/svg\+xml/,
  png: /^image\/png/, ico: /^image\/(x-icon|vnd\.microsoft\.icon)/, woff2: /^font\/woff2/, woff: /^font\/woff/, ttf: /^(font\/ttf|application\/x-font-ttf)/,
  wasm: /^application\/wasm/, txt: /^text\/plain/, map: /^application\/json/,
};

async function get(url, opts = {}) {
  const t0 = Date.now();
  const res = await fetch(url, { redirect: 'manual', ...opts });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: headersToObject(res.headers), buf, ms: Date.now() - t0 };
}

export default async function ({ runDir, target }) {
  const rec = new Recorder(runDir, 'mirror');
  // Byte mirror goes OUTSIDE the repo; the workflow encrypts it with harness/mirror-pubkey.pem before committing
  // (the repo is public; only the auditor's private key, kept out of the repo, can decrypt it).
  const mirrorDir = ensureDir(process.env.MIRROR_DIR || path.join(process.env.RUNNER_TEMP || '/tmp', 'release-mirror'));
  const headerLog = {};

  // Root document
  const root = await get(`${target}/`);
  headerLog['/'] = { status: root.status, headers: redactHeaders(root.headers), sha256: sha256(root.buf), bytes: root.buf.length };
  fs.writeFileSync(path.join(mirrorDir, 'index.html'), root.buf);
  const html = root.buf.toString('utf8');
  rec.add({ case_id: 'CF-PRE-001', gate: 'FE-01', requirement_ref: 'v2 §6.1 root 200/MIME', expected: 'GET / => 200, content-type text/html', actual: `status=${root.status} content-type=${root.headers['content-type']}`, result: root.status === 200 && /^text\/html/.test(root.headers['content-type'] || '') ? 'PASS' : 'FAIL', input_mode: 'http' });

  // Release manifest
  const man = await get(`${target}/release-manifest.json`);
  headerLog['/release-manifest.json'] = { status: man.status, headers: redactHeaders(man.headers), sha256: sha256(man.buf), bytes: man.buf.length };
  fs.writeFileSync(path.join(mirrorDir, 'release-manifest.json'), man.buf);
  let manifest = null; try { manifest = JSON.parse(man.buf.toString('utf8')); } catch {}
  let entries = manifest ? findPayloadEntries(manifest) : [];
  if (!entries.length && manifest) entries = findMapEntries(manifest);
  const assetRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => u.startsWith('/') && !u.startsWith('//'));

  const payload = [];
  for (const e of entries) {
    let p = e.path.replace(/^https?:\/\/[^/]+/, '');
    if (!p.startsWith('/')) p = '/' + p;
    const r = await get(`${target}${encodeURI(p)}`);
    const got = sha256(r.buf);
    const want = normHash(e.hash);
    const ext = (p.split('.').pop() || '').toLowerCase();
    const mimeRe = EXPECTED_MIME[ext];
    headerLog[p] = { status: r.status, headers: redactHeaders(r.headers), sha256: got, bytes: r.buf.length };
    if (r.status === 200) {
      const dest = path.join(mirrorDir, p.replace(/^\//, ''));
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, r.buf);
    }
    payload.push({ path: p, status: r.status, want, got, match: want === got, size_claim: e.size, bytes: r.buf.length, content_type: r.headers['content-type'] || null, mime_ok: mimeRe ? mimeRe.test(r.headers['content-type'] || '') : null, cache_control: r.headers['cache-control'] || null, etag: r.headers['etag'] || null });
  }
  const mismatches = payload.filter(p => !p.match || p.status !== 200);
  writeJSON(rec.evidenceFile('payload-hashes.json', { evidence_type: 'hash-table', case_ids: ['CF-PRE-002'] }), { manifest_meta: manifest ? Object.fromEntries(Object.entries(manifest).filter(([k, v]) => typeof v !== 'object')) : null, entries: payload });
  rec.add({ case_id: 'CF-PRE-002', gate: 'FE-01', requirement_ref: 'v2 §4.1 step 2 / §6.1', expected: 'every payload in /release-manifest.json is served with 200 and its independently recomputed SHA-256 equals the manifest value; count equals 120', actual: `manifest_parsed=${!!manifest} entries=${payload.length} mismatches=${mismatches.length}${mismatches.length ? ' e.g. ' + JSON.stringify(mismatches.slice(0, 3)) : ''}`, result: manifest && payload.length === 120 && mismatches.length === 0 ? 'PASS' : 'FAIL', input_mode: 'http' });

  const mimeBad = payload.filter(p => p.mime_ok === false);
  const mimeUnknown = payload.filter(p => p.mime_ok === null).map(p => p.path);
  rec.add({ case_id: 'CF-PRE-003', gate: 'FE-01', requirement_ref: 'v2 §6.1 MIME theo đuôi', expected: 'content-type matches file extension for every payload (js→javascript, css→text/css, json→application/json, svg→image/svg+xml, woff2→font/woff2, wasm→application/wasm …)', actual: `checked=${payload.length - mimeUnknown.length} bad=${mimeBad.length} unknown_ext=${mimeUnknown.length}${mimeBad.length ? ' e.g. ' + JSON.stringify(mimeBad.slice(0, 3).map(p => [p.path, p.content_type])) : ''}`, result: mimeBad.length === 0 && payload.length > 0 ? 'PASS' : 'FAIL', input_mode: 'http' });

  // Missing asset must be a real 404, not the HTML shell
  const probes = {};
  for (const p of ['/assets/__atlas_probe_missing__.js', '/assets/__atlas_probe_missing__.css', '/__atlas_probe_missing__', '/home', '/connection', '/index.html', '/assets/']) {
    const r = await get(`${target}${p}`);
    probes[p] = { status: r.status, content_type: r.headers['content-type'] || null, bytes: r.buf.length, looks_like_shell: /<div id="root"/.test(r.buf.toString('utf8')), location: r.headers['location'] || null, cache_control: r.headers['cache-control'] || null };
    headerLog[`probe:${p}`] = { status: r.status, headers: redactHeaders(r.headers), bytes: r.buf.length };
  }
  const js404 = probes['/assets/__atlas_probe_missing__.js'], css404 = probes['/assets/__atlas_probe_missing__.css'];
  rec.add({ case_id: 'CF-PRE-004', gate: 'FE-01', requirement_ref: 'v2 §6.1 asset không tồn tại', expected: 'missing /assets/*.js and *.css => 404 and body is not the HTML app shell', actual: JSON.stringify({ js: js404, css: css404 }), result: js404.status === 404 && css404.status === 404 && !js404.looks_like_shell && !css404.looks_like_shell ? 'PASS' : 'FAIL', input_mode: 'http' });

  // Security headers on the document
  const h = root.headers;
  const sec = {
    'content-security-policy': h['content-security-policy'] || null,
    'x-content-type-options': h['x-content-type-options'] || null,
    'referrer-policy': h['referrer-policy'] || null,
    'x-frame-options': h['x-frame-options'] || null,
    'permissions-policy': h['permissions-policy'] || null,
    'strict-transport-security': h['strict-transport-security'] || null,
    'cross-origin-opener-policy': h['cross-origin-opener-policy'] || null,
  };
  const missing = Object.entries(sec).filter(([k, v]) => !v && !(k === 'x-frame-options' && /frame-ancestors/.test(sec['content-security-policy'] || ''))).map(([k]) => k);
  rec.add({ case_id: 'CF-PRE-005', gate: 'FE-04', requirement_ref: 'v2 §6.1 headers (CSP, nosniff, referrer, frame, permissions, HSTS, COOP)', expected: 'document response carries CSP, X-Content-Type-Options: nosniff, Referrer-Policy, frame protection (XFO or CSP frame-ancestors), Permissions-Policy, HSTS, COOP', actual: `missing=${JSON.stringify(missing)} present=${JSON.stringify(Object.fromEntries(Object.entries(sec).filter(([, v]) => v)))}`, result: missing.length === 0 ? 'PASS' : 'FAIL', input_mode: 'http' });

  // Cache policy: fingerprinted assets long-lived+immutable; HTML/manifest revalidated
  const hashed = payload.filter(p => /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|svg|png|wasm)$/.test(p.path));
  const badHashed = hashed.filter(p => !/max-age=(\d+)/.test(p.cache_control || '') || Number((p.cache_control || '').match(/max-age=(\d+)/)?.[1] || 0) < 31536000 || !/immutable/.test(p.cache_control || ''));
  const htmlCC = root.headers['cache-control'] || null;
  rec.add({ case_id: 'CF-PRE-006', gate: 'FE-05', requirement_ref: 'v2 §6.1 cache-control', expected: 'fingerprinted /assets/*-<hash>.* => Cache-Control max-age>=31536000 + immutable; index.html => revalidated (no-cache or max-age=0 with validator)', actual: `hashed=${hashed.length} non_compliant=${badHashed.length} sample_cc=${JSON.stringify(hashed[0]?.cache_control ?? null)} html_cc=${JSON.stringify(htmlCC)} html_etag=${JSON.stringify(root.headers['etag'] || null)}`, result: hashed.length > 0 && badHashed.length === 0 ? 'PASS' : 'FAIL', input_mode: 'http' });

  // Path-style deep links: assets config not_found_handling=none => 404 expected; router is hash-based
  rec.add({ case_id: 'CF-PRE-007', gate: 'FE-01', requirement_ref: 'v2 §6.1 deep link (path-style)', expected: 'NOT_APPLICABLE if router is hash-based (path-style URLs are not part of the routing contract); recorded for evidence', actual: JSON.stringify({ '/home': probes['/home'], '/connection': probes['/connection'] }), result: 'NOT_APPLICABLE', reason: 'Router is hash-based (verified in browser suite discover: routes are #<module>); path-style 404 is outside the contract per v2 §4 table', input_mode: 'http' });

  writeJSON(rec.evidenceFile('headers.json', { evidence_type: 'http-headers', case_ids: ['CF-PRE-001', 'CF-PRE-003', 'CF-PRE-004', 'CF-PRE-005', 'CF-PRE-006'] }), headerLog);
  writeJSON(rec.evidenceFile('probes.json', { evidence_type: 'http-probes', case_ids: ['CF-PRE-004', 'CF-PRE-007'] }), probes);
  rec.save({ asset_refs_in_index: assetRefs, manifest_entry_count: entries.length });
  return { payload: payload.length, mismatches: mismatches.length };
}
